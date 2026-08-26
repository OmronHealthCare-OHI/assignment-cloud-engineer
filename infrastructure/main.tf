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
