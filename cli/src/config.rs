use anyhow::Result;
use dirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub jwt: Option<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        let config_dir = get_config_dir()?;
        let config_file = config_dir.join("config.json");

        if !config_file.exists() {
            return Ok(Config { jwt: None });
        }

        let config_str = fs::read_to_string(config_file)?;
        let config = serde_json::from_str(&config_str)?;
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let config_dir = get_config_dir()?;
        fs::create_dir_all(&config_dir)?;
        
        let config_file = config_dir.join("config.json");
        let config_str = serde_json::to_string_pretty(self)?;
        fs::write(config_file, config_str)?;
        Ok(())
    }

    pub fn set_jwt(&mut self, jwt: String) -> Result<()> {
        self.jwt = Some(jwt);
        self.save()
    }

    pub fn clear_jwt(&mut self) -> Result<()> {
        self.jwt = None;
        self.save()
    }
}

fn get_config_dir() -> Result<PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine config directory"))?
        .join("ariana");
    Ok(config_dir)
}
