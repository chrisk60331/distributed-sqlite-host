locals {
  service_name = "${var.app_name}-${var.environment}"
}

# --- IAM: ECR access role (for App Runner to pull images) ---

data "aws_iam_policy_document" "ecr_access_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecr_access" {
  name               = "${local.service_name}-ecr-access"
  assume_role_policy = data.aws_iam_policy_document.ecr_access_assume.json
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- IAM: Instance role (for S3/SSM access at runtime) ---

data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${local.service_name}-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

data "aws_caller_identity" "current" {}

# SSM access for secrets (if any)
resource "aws_iam_role_policy" "instance_ssm" {
  name = "${local.service_name}-ssm-access"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/${var.environment}/*"
      }
    ]
  })
}

# S3 access for Litestream replication
resource "aws_iam_role_policy" "instance_litestream_s3" {
  count = var.litestream_bucket != "" ? 1 : 0
  name  = "${local.service_name}-litestream-s3"
  role  = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.litestream_bucket}",
          "arn:aws:s3:::${var.litestream_bucket}/*"
        ]
      }
    ]
  })
}

# --- Auto-scaling ---

resource "aws_apprunner_auto_scaling_configuration_version" "this" {
  auto_scaling_configuration_name = "${local.service_name}-scaling"
  min_size                        = var.min_instances
  max_size                        = var.max_instances
  max_concurrency                 = var.max_concurrency
}

# --- App Runner Service ---

resource "aws_apprunner_service" "this" {
  service_name = local.service_name

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.this.arn

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.ecr_access.arn
    }

    image_repository {
      image_identifier      = "${var.ecr_repository_url}:${var.environment}-${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = tostring(var.container_port)

        runtime_environment_variables = var.environment_variables

        runtime_environment_secrets = {
          for k, arn in var.ssm_secret_arns : k => arn
        }
      }
    }

    auto_deployments_enabled = false
  }

  instance_configuration {
    cpu               = tostring(var.cpu)
    memory            = tostring(var.memory)
    instance_role_arn = aws_iam_role.instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = var.health_check_path
    interval            = var.health_check_interval
    timeout             = var.health_check_timeout
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
  }
}

# --- Custom Domain ---

resource "aws_apprunner_custom_domain_association" "this" {
  count                = var.custom_domain != "" ? 1 : 0
  domain_name          = var.custom_domain
  service_arn          = aws_apprunner_service.this.arn
  enable_www_subdomain = false
}

# --- CloudWatch: Log retention ---

resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/apprunner/${local.service_name}/${aws_apprunner_service.this.service_id}/logs/application"
  retention_in_days = var.log_retention_days

  lifecycle {
    prevent_destroy = true
  }
}

# --- CloudWatch: SNS topic for alerts (conditional) ---

resource "aws_sns_topic" "alerts" {
  count = var.alarm_email != "" ? 1 : 0
  name  = "${local.service_name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# --- CloudWatch: App Runner 5xx alarm ---

resource "aws_cloudwatch_metric_alarm" "apprunner_5xx" {
  count               = var.alarm_email != "" ? 1 : 0
  alarm_name          = "${local.service_name}-apprunner-5xx"
  alarm_description   = ">=10 App Runner 5xx responses in 5 minutes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxStatusResponses"
  namespace           = "AWS/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    ServiceName = local.service_name
    ServiceId   = aws_apprunner_service.this.service_id
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]
}
