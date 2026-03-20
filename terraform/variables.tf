variable "aws_region" {
  type        = string
  description = "AWS region for deployment."
  default     = "us-west-2"
}

variable "app_name" {
  type        = string
  description = "Base name for App Runner and related resources."
  default     = "liteloft"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)."
  validation {
    condition     = contains(["dev", "test", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, test, staging, prod."
  }
}

variable "container_port" {
  type        = number
  description = "Container port exposed by the service."
  default     = 8000
}

variable "ecr_image_tag" {
  type        = string
  description = "Base image tag for ECR images."
  default     = "latest"
}

variable "cpu" {
  type        = number
  description = "CPU units for App Runner."
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu)
    error_message = "cpu must be one of 256, 512, 1024, 2048, 4096."
  }
}

variable "memory" {
  type        = number
  description = "Memory (MB) for App Runner."
  default     = 2048
  validation {
    condition     = var.memory >= 512 && var.memory <= 12288
    error_message = "memory must be between 512 and 12288 MB."
  }
}

variable "min_instances" {
  type        = number
  description = "Minimum App Runner instances."
  default     = 1
}

variable "max_instances" {
  type        = number
  description = "Maximum App Runner instances."
  default     = 1
}

variable "max_concurrency" {
  type        = number
  description = "Maximum requests per instance."
  default     = 100
}

variable "health_check_path" {
  type        = string
  description = "Health check path."
  default     = "/v1/health"
}

variable "health_check_interval" {
  type        = number
  description = "Health check interval in seconds."
  default     = 20
}

variable "health_check_timeout" {
  type        = number
  description = "Health check timeout in seconds."
  default     = 19
}

variable "health_check_healthy_threshold" {
  type        = number
  description = "Number of consecutive successes to mark healthy."
  default     = 1
}

variable "health_check_unhealthy_threshold" {
  type        = number
  description = "Number of consecutive failures to mark unhealthy."
  default     = 1
}

variable "ecr_retain_count" {
  type        = number
  description = "Number of tagged images to retain per environment."
  default     = 10
}

variable "ecr_untagged_expire_days" {
  type        = number
  description = "Days before untagged images expire."
  default     = 7
}

# --- Application secrets (stored in SSM Parameter Store) ---

variable "secrets" {
  type        = map(string)
  description = "Sensitive secrets stored in SSM. Map of env-var-name => value. Keys: BACKBOARD_API_KEY, RESEND_API_KEY, AUTH_JWT_SECRET, AUTH_SECRET, GMAIL_APP_PASSWORD, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_SECRET."
  sensitive   = true
}

# --- URLs ---

variable "app_base_url" {
  type        = string
  description = "Public base URL of the application (e.g. https://app.liteloft.app). Used for APP_BASE_URL, NEXT_PUBLIC_APP_URL, WEB_APP_URL, AUTH_URL."
}

variable "api_base_url" {
  type        = string
  description = "Public API base URL (API_BASE_URL). Typically same as app_base_url."
}

variable "next_public_api_base_url" {
  type        = string
  description = "Public API base URL for the browser client (NEXT_PUBLIC_API_BASE_URL), e.g. https://app.liteloft.app/v1."
}

# --- Auth ---

variable "auth_mode" {
  type        = string
  description = "Authentication mode (AUTH_MODE)."
  default     = "oauth"
}

variable "app_jwt_namespace" {
  type        = string
  description = "JWT namespace for custom claims (APP_JWT_NAMESPACE)."
  default     = "https://liteloft.app"
}

# --- Database ---

variable "database_url" {
  type        = string
  description = "SQLAlchemy database URL (DATABASE_URL)."
  default     = "sqlite+pysqlite:////tmp/data/liteloft.db"
}

variable "sqlite_db_path" {
  type        = string
  description = "Path to the SQLite database file on disk (SQLITE_DB_PATH)."
  default     = "/tmp/data/liteloft.db"
}

# --- Email ---

variable "resend_from_email" {
  type        = string
  description = "Sender address for Resend transactional email (RESEND_FROM_EMAIL)."
  default     = "noreply@liteloft.app"
}

variable "gmail_user" {
  type        = string
  description = "Gmail account used for SMTP alert delivery (GMAIL_USER)."
  default     = ""
}

variable "alert_recipient_email" {
  type        = string
  description = "Recipient email for application-level alerts (ALERT_RECIPIENT_EMAIL)."
  default     = ""
}

# --- Backboard ---

variable "backboard_base_url" {
  type        = string
  description = "Backboard API base URL (BACKBOARD_BASE_URL)."
  default     = "https://app.backboard.io/api"
}

variable "backboard_llm_provider" {
  type        = string
  description = "LLM provider for Backboard (BACKBOARD_LLM_PROVIDER)."
  default     = "openai"
}

variable "backboard_model_name" {
  type        = string
  description = "LLM model name for Backboard (BACKBOARD_MODEL_NAME)."
  default     = "gpt-4o"
}

variable "backboard_memory_mode" {
  type        = string
  description = "Backboard memory mode On/Off (BACKBOARD_MEMORY_MODE)."
  default     = "On"
}

# --- OAuth: Google ---

variable "google_client_id" {
  type        = string
  description = "Google OAuth client ID (GOOGLE_CLIENT_ID)."
  default     = ""
}

variable "google_callback_url" {
  type        = string
  description = "Google OAuth callback path (GOOGLE_CALLBACK_URL)."
  default     = "/oauth/google/callback"
}

# --- OAuth: GitHub ---

variable "github_client_id" {
  type        = string
  description = "GitHub OAuth client ID — shared by auth and connector (GITHUB_CLIENT_ID / CONNECTOR_GITHUB_CLIENT_ID / GITHUB_ID)."
  default     = ""
}

variable "github_callback_url" {
  type        = string
  description = "GitHub OAuth callback path (GITHUB_CALLBACK_URL)."
  default     = "/oauth/github/callback"
}

# --- Litestream S3 ---

variable "litestream_bucket" {
  type        = string
  description = "S3 bucket name for Litestream SQLite backups."
}

# --- Custom domain ---

variable "custom_domain" {
  type        = string
  description = "Custom domain to associate with App Runner. Leave empty to skip."
  default     = ""
}

# --- Monitoring ---

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days."
  default     = 90
}

variable "alarm_email" {
  type        = string
  description = "Email address for CloudWatch alarm notifications. Leave empty to skip."
  default     = ""
}
