use anyhow::{anyhow, Result};
use ariana_server::web::auth::{
    AuthResponse, RequestLoginCodeRequest, ValidateLoginCodeRequest,
};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::{blocking::Client, StatusCode};
use std::io::{self, Write};

use crate::config::Config;

pub async fn ensure_authenticated(api_url: &str) -> Result<()> {
    let mut config = Config::load()?;

    // Try existing JWT if available
    if let Some(jwt) = &config.jwt {
        let client = Client::new();
        let res = client
            .get(&format!("{}/authenticated/account", api_url))
            .header("Authorization", format!("Bearer {}", jwt))
            .send()?;

        if res.status().is_success() {
            println!("[Ariana] Successfully authenticated with existing credentials");
            let account: AuthResponse = res.json()?;
            println!("[Ariana] Account balance: {} credits", account.account.credits);
            return Ok(());
        }

        // Clear invalid JWT
        config.clear_jwt()?;
    }

    // Get email from user
    print!("[Ariana] Enter your email: ");
    io::stdout().flush()?;
    let mut email = String::new();
    io::stdin().read_line(&mut email)?;
    let email = email.trim().to_string();

    // Try to request login code
    let client = Client::new();
    let res = client
        .post(&format!("{}/unauthenticated/request-login-code", api_url))
        .json(&RequestLoginCodeRequest { email: email.clone() })
        .send()?;

    match res.status() {
        StatusCode::OK => {
            // Existing account - handle login code
            println!("[Ariana] Login code sent to your email");
            print!("[Ariana] Enter the login code: ");
            io::stdout().flush()?;
            let mut code = String::new();
            io::stdin().read_line(&mut code)?;
            let code = code.trim().to_string();

            let res = client
                .post(&format!("{}/unauthenticated/validate-login-code", api_url))
                .json(&ValidateLoginCodeRequest {
                    email: email.clone(),
                    code,
                })
                .send()?;

            if !res.status().is_success() {
                return Err(anyhow!("Invalid login code: {}", res.text()?));
            }

            let auth_response: AuthResponse = res.json()?;
            config.set_jwt(auth_response.token)?;
            println!("[Ariana] Successfully logged in");
            println!("[Ariana] Account balance: {} credits", auth_response.account.credits);
        }
        StatusCode::NOT_FOUND => {
            // New account - register
            println!("[Ariana] No account found with this email. Creating new account...");
            
            // Generate random password
            let password: String = rand::thread_rng()
                .sample_iter(&Alphanumeric)
                .take(32)
                .map(char::from)
                .collect();

            let res = client
                .post(&format!("{}/unauthenticated/register", api_url))
                .json(&ariana_server::web::auth::RegisterRequest {
                    email: email.clone(),
                    password: password.clone(),
                })
                .send()?;

            if !res.status().is_success() {
                return Err(anyhow!("Failed to register: {}", res.text()?));
            }

            println!("[Ariana] Account created. Verification code sent to your email.");
            print!("[Ariana] Enter the verification code: ");
            io::stdout().flush()?;
            let mut code = String::new();
            io::stdin().read_line(&mut code)?;
            let code = code.trim().to_string();

            let res = client
                .post(&format!("{}/unauthenticated/validate-email", api_url))
                .json(&ariana_server::web::auth::VerifyEmailRequest {
                    code: code.clone(),
                })
                .send()?;

            if !res.status().is_success() {
                return Err(anyhow!("Invalid verification code: {}", res.text()?));
            }

            // Now login
            let res = client
                .post(&format!("{}/unauthenticated/login", api_url))
                .json(&ariana_server::web::auth::LoginRequest {
                    email: email.clone(),
                    password: password.clone(),
                })
                .send()?;

            if !res.status().is_success() {
                return Err(anyhow!("Failed to login after registration: {}", res.text()?));
            }

            let auth_response: AuthResponse = res.json()?;
            config.set_jwt(auth_response.token)?;
            println!("[Ariana] Successfully registered and logged in");
            println!("[Ariana] Account balance: {} credits", auth_response.account.credits);
        }
        _ => {
            return Err(anyhow!(
                "Unexpected error requesting login code: {}",
                res.text()?
            ));
        }
    }

    Ok(())
}
