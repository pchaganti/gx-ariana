import React from 'react';

interface VaultDetailViewProps {
  vaultId: string | null;
}

const VaultDetailView: React.FC<VaultDetailViewProps> = ({ vaultId }) => {
  if (!vaultId) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        color: 'white',
        fontSize: '1.5rem',
        fontFamily: 'monospace'
      }}>
        No Vault Selected
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'black',
      color: 'white',
      fontSize: '2rem',
      fontFamily: 'monospace',
      overflow: 'hidden', // Ensure no scrollbars appear
      boxSizing: 'border-box' // Ensure padding/border don't add to size
    }}>
      {vaultId}
    </div>
  );
};

export default VaultDetailView;
