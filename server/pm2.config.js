module.exports = {
  apps: [{
    name: "aiops-saas-server",
    script: "./app.js",
    env: {
      DATABASE_URL: "postgresql://aiops_saas:aiops_saas_pwd_2026@127.0.0.1:5432/aiops_saas",
      JWT_SECRET: "f9b8c7d4581ef1226e72efec9fe5b07be69793e9dd5ae7f7e8dd1d26c40f1984",
      JWT_EXPIRES_IN: "7d",
      ENCRYPTION_KEY: "3c63261efb83e488741fc29b4a250ba9b50837482e18d3fb08831f932e6bd4fc",
      VAULT_KEY: "saas-vault-key-2026-change-me-32b",
      DEEPSEEK_API_URL: "https://api.deepseek.com/v1/chat/completions",
      DEEPSEEK_API_KEY: "sk-ccc4185e87c94590bbad3b57bc91740f",
      DEEPSEEK_MODEL: "deepseek-chat",
      NODE_ENV: "production",
      PORT: "5290",
      REGISTRATION_OPEN: "true",
      CRYPTO_PAYMENT_ADDRESS: "0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5",
      CRYPTO_RPC_URL: "https://ethereum-sepolia.publicnode.com"
    }
  }]
};
