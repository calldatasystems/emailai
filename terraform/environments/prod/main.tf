# EmailAI Production Environment
# Next.js application with ALB + 2 EC2 instances + RDS PostgreSQL
# AI models hosted on Vast.ai servers (separate infrastructure)

# VPC and Networking
module "vpc" {
  source = "../../modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  allowed_ssh_cidrs    = var.allowed_ssh_cidrs
}

# RDS PostgreSQL Database
module "database" {
  source = "../../modules/rds"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  allowed_cidr_blocks   = [var.vpc_cidr]
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = var.db_password
  db_instance_class     = var.db_instance_class
  db_allocated_storage  = var.db_allocated_storage
  db_engine_version     = var.db_engine_version
  multi_az              = var.db_multi_az
  backup_retention_days = var.db_backup_retention_days
}

# Application Load Balancer
module "alb" {
  source = "../../modules/alb"

  project_name              = var.project_name
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.public_subnet_ids
  security_group_ids        = [module.vpc.alb_security_group_id]
  target_port               = 3000
  health_check_path         = "/api/health"
  certificate_arn           = var.certificate_arn
  enable_deletion_protection = var.enable_deletion_protection
}

# EmailAI Application Servers (2 instances)
module "emailai_servers" {
  source = "../../modules/emailai"

  project_name       = var.project_name
  environment        = var.environment
  instance_count     = var.instance_count
  instance_type      = var.instance_type
  subnet_ids         = module.vpc.public_subnet_ids
  security_group_ids = [module.vpc.emailai_security_group_id]
  root_volume_size   = var.root_volume_size
  target_group_arn   = module.alb.target_group_arn
  app_port           = 3000
}
