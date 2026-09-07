terraform {
  # Matches the OHI service-repo template floor. No backend block here: this
  # assignment never touches real state — plan/validate locally only.
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.30"
    }
  }
}

# Points the AWS provider at LocalStack instead of real AWS. This repo never
# touches real AWS state (see the note above); local apply only needs the
# emulator reachable and dummy credentials. Optional — see
# infrastructure/README.md for the full local-apply walkthrough.
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    dynamodb = "http://localhost:4566"
  }
}

# Naming and tags for everything in this configuration. Our real service repos
# use an internal wrapper of this same CloudPosse module; the public upstream
# stands in here, pre-filled — you don't need to touch it. Consume
# `module.label.id` for resource names and `module.label.tags` for tags.
module "label" {
  source  = "cloudposse/label/null"
  version = "0.25.0"

  namespace = "ohi"
  stage     = "tst"
  name      = "measurements"

  tags = {
    owner        = "cloud-assignment"
    "managed-by" = "terraform"
  }
}
