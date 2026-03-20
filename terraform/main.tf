terraform {
  required_version = ">= 1.4.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "litestream_bucket" {
  bucket = "${var.app_name}-app-data-${var.environment}"
}

locals {
  service_name = "${var.app_name}-${var.environment}"

  environment_variables = {
    HOST               = "0.0.0.0"
    HOSTNAME           = "0.0.0.0"
    PORT               = tostring(var.container_port)
    ENVIRONMENT       = var.environment
    AWS_REGION        = var.aws_region
    LITESTREAM_BUCKET = aws_s3_bucket.litestream_bucket.id
    LITESTREAM_REGION = var.aws_region

    # Database
    DATABASE_URL   = var.database_url
    SQLITE_DB_PATH = var.sqlite_db_path

    # URLs
    APP_BASE_URL             = var.app_base_url
    NEXT_PUBLIC_APP_URL      = var.app_base_url
    WEB_APP_URL              = var.app_base_url
    AUTH_URL                 = var.app_base_url
    AUTH_TRUST_HOST          = "true"
    API_BASE_URL             = var.api_base_url
    API_INTERNAL_URL         = "http://127.0.0.1:9000/v1"
    NEXT_PUBLIC_API_BASE_URL = var.next_public_api_base_url

    # Auth
    AUTH_MODE         = var.auth_mode
    APP_JWT_NAMESPACE = var.app_jwt_namespace

    # Email
    RESEND_FROM_EMAIL     = var.resend_from_email
    GMAIL_USER            = var.gmail_user
    ALERT_RECIPIENT_EMAIL = var.alert_recipient_email

    # Backboard
    BACKBOARD_BASE_URL      = var.backboard_base_url
    BACKBOARD_LLM_PROVIDER  = var.backboard_llm_provider
    BACKBOARD_MODEL_NAME    = var.backboard_model_name
    BACKBOARD_MEMORY_MODE   = var.backboard_memory_mode

    # OAuth: Google
    GOOGLE_CLIENT_ID    = var.google_client_id
    GOOGLE_CALLBACK_URL = var.google_callback_url

    # OAuth: GitHub (shared across auth + connector)
    GITHUB_CLIENT_ID           = var.github_client_id
    CONNECTOR_GITHUB_CLIENT_ID = var.github_client_id
    GITHUB_ID                  = var.github_client_id
    GITHUB_CALLBACK_URL        = var.github_callback_url
  }
}

module "ssm" {
  source = "./modules/ssm-secrets"

  app_name    = var.app_name
  environment = var.environment
  secrets     = var.secrets
}

module "ecr" {
  source = "./modules/ecr"

  repository_name      = local.service_name
  environment          = var.environment
  retain_count         = var.ecr_retain_count
  untagged_expire_days = var.ecr_untagged_expire_days
}

module "apprunner" {
  source = "./modules/apprunner"

  app_name           = var.app_name
  environment        = var.environment
  aws_region         = var.aws_region
  ecr_repository_url = module.ecr.repository_url
  image_tag          = var.ecr_image_tag
  container_port     = var.container_port
  cpu                = var.cpu
  memory             = var.memory
  min_instances      = var.min_instances
  max_instances      = var.max_instances
  max_concurrency    = var.max_concurrency

  health_check_path                = var.health_check_path
  health_check_interval            = var.health_check_interval
  health_check_timeout             = var.health_check_timeout
  health_check_healthy_threshold   = var.health_check_healthy_threshold
  health_check_unhealthy_threshold = var.health_check_unhealthy_threshold

  environment_variables = local.environment_variables
  ssm_secret_arns = merge(
    module.ssm.arns,
    {
      # Aliases that share the same secret value as GITHUB_CLIENT_SECRET
      CONNECTOR_GITHUB_CLIENT_SECRET = module.ssm.arns["GITHUB_CLIENT_SECRET"]
      GITHUB_SECRET                  = module.ssm.arns["GITHUB_CLIENT_SECRET"]
    }
  )

  litestream_bucket = aws_s3_bucket.litestream_bucket.id

  custom_domain      = var.custom_domain
  log_retention_days = var.log_retention_days
  alarm_email        = var.alarm_email
}
