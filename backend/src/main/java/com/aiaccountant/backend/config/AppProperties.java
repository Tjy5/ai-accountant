package com.aiaccountant.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private final Cors cors = new Cors();
    private final Jwt jwt = new Jwt();
    private final Ai ai = new Ai();

    public Cors getCors() {
        return cors;
    }

    public Jwt getJwt() {
        return jwt;
    }

    public Ai getAi() {
        return ai;
    }

    public static class Cors {
        private String allowedOrigins = "http://localhost:3000,http://127.0.0.1:3000";

        public String getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(String allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Jwt {
        private String secret = "fallback_secret_for_dev_123456_do_not_use_in_prod";
        private String expiresIn = "30d";

        public String getSecret() {
            return secret;
        }

        public void setSecret(String secret) {
            this.secret = secret;
        }

        public String getExpiresIn() {
            return expiresIn;
        }

        public void setExpiresIn(String expiresIn) {
            this.expiresIn = expiresIn;
        }
    }

    public static class Ai {
        private boolean enabled = true;
        private String apiKey = "";
        private String baseUrl = "https://api.openai.com/v1";
        private String model = "gpt-4o-mini";
        private String baseUrlAllowlist = "";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public String getBaseUrlAllowlist() {
            return baseUrlAllowlist;
        }

        public void setBaseUrlAllowlist(String baseUrlAllowlist) {
            this.baseUrlAllowlist = baseUrlAllowlist;
        }
    }
}
