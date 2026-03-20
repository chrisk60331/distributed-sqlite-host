terraform {
  backend "s3" {
    # Update bucket name to match what bootstrap created (include your account ID for uniqueness)
    bucket  = "liteloft-terraform-state-059623506914"
    key     = "liteloft/terraform.tfstate"
    region  = "us-west-2"
    encrypt = true
  }
}
