# VPC Module - Creates network infrastructure or uses existing VPC

# Data source for existing VPC (when provided)
data "aws_vpc" "existing" {
  count = var.existing_vpc_id != "" ? 1 : 0
  id    = var.existing_vpc_id
}

# VPC (only create if existing_vpc_id is not provided)
resource "aws_vpc" "main" {
  count                = var.existing_vpc_id == "" ? 1 : 0
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# Local value to reference the VPC ID
locals {
  vpc_id       = var.existing_vpc_id != "" ? data.aws_vpc.existing[0].id : aws_vpc.main[0].id
  use_existing = var.existing_vpc_id != ""
  create_new   = var.existing_vpc_id == ""
}

# Data sources for existing resources (when using existing VPC)
data "aws_internet_gateway" "existing" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "attachment.vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_subnets" "existing_public" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-subnet-*"
  }
}

data "aws_subnet" "existing_public" {
  count = local.use_existing ? length(data.aws_subnets.existing_public[0].ids) : 0
  id    = sort(data.aws_subnets.existing_public[0].ids)[count.index]
}

data "aws_subnets" "existing_private" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-private-subnet-*"
  }
}

data "aws_subnet" "existing_private" {
  count = local.use_existing ? length(data.aws_subnets.existing_private[0].ids) : 0
  id    = sort(data.aws_subnets.existing_private[0].ids)[count.index]
}

# Data sources for existing security groups
data "aws_security_group" "existing_wazo" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "group-name"
    values = ["${var.project_name}-${var.environment}-wazo-sg"]
  }

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_security_group" "existing_litellm" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "group-name"
    values = ["${var.project_name}-${var.environment}-litellm-sg"]
  }

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_security_group" "existing_alb" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "group-name"
    values = ["${var.project_name}-${var.environment}-alb-sg"]
  }

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

data "aws_security_group" "existing_emailai" {
  count = local.use_existing ? 1 : 0

  filter {
    name   = "group-name"
    values = ["${var.project_name}-${var.environment}-emailai-sg"]
  }

  filter {
    name   = "vpc-id"
    values = [local.vpc_id]
  }
}

# Internet Gateway (only create if not using existing VPC)
resource "aws_internet_gateway" "main" {
  count  = local.create_new ? 1 : 0
  vpc_id = local.vpc_id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# Public Subnets (only create if not using existing VPC)
resource "aws_subnet" "public" {
  count                   = local.create_new ? length(var.public_subnet_cidrs) : 0
  vpc_id                  = local.vpc_id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-subnet-${count.index + 1}"
    Type = "public"
  }
}

# Private Subnets (only create if not using existing VPC)
resource "aws_subnet" "private" {
  count             = local.create_new ? length(var.private_subnet_cidrs) : 0
  vpc_id            = local.vpc_id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-${var.environment}-private-subnet-${count.index + 1}"
    Type = "private"
  }
}

# Public Route Table (only create if not using existing VPC)
resource "aws_route_table" "public" {
  count  = local.create_new ? 1 : 0
  vpc_id = local.vpc_id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

# Public Route Table Association (only for newly created subnets)
resource "aws_route_table_association" "public" {
  count          = local.create_new ? length(aws_subnet.public) : 0
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

# Security Group for Wazo Server (only create if not using existing VPC)
resource "aws_security_group" "wazo" {
  count       = local.create_new ? 1 : 0
  name        = "${var.project_name}-${var.environment}-wazo-sg"
  description = "Security group for Wazo Platform servers"
  vpc_id      = local.vpc_id

  # SSH Access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  # HTTPS for Web UI
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (will redirect to HTTPS)
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP (UDP) - VoIP signaling
  ingress {
    description = "SIP UDP"
    from_port   = 5060
    to_port     = 5060
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP (TCP) - VoIP signaling
  ingress {
    description = "SIP TCP"
    from_port   = 5060
    to_port     = 5060
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SIP TLS
  ingress {
    description = "SIP TLS"
    from_port   = 5061
    to_port     = 5061
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # RTP Media - Voice/Video streams
  ingress {
    description = "RTP Media"
    from_port   = 10000
    to_port     = 20000
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # WebSocket for WebRTC
  ingress {
    description = "WebSocket"
    from_port   = 8088
    to_port     = 8089
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-wazo-sg"
  }
}

# Security Group for LiteLLM AI Gateway (only create if not using existing VPC)
resource "aws_security_group" "litellm" {
  count       = local.create_new ? 1 : 0
  name        = "${var.project_name}-${var.environment}-litellm-sg"
  description = "Security group for LiteLLM AI Gateway"
  vpc_id      = local.vpc_id

  # SSH Access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  # LiteLLM API (default port 4000)
  ingress {
    description = "LiteLLM API"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Consider restricting to your IP ranges
  }

  # HTTPS (if using reverse proxy)
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (redirect to HTTPS)
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # LibreChat UI
  ingress {
    description = "LibreChat UI"
    from_port   = 3080
    to_port     = 3080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic (needed for API calls to OpenAI, Claude, etc.)
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-litellm-sg"
  }
}

# Security Group for ALB (Application Load Balancer) (only create if not using existing VPC)
resource "aws_security_group" "alb" {
  count       = local.create_new ? 1 : 0
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = local.vpc_id

  # HTTP
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}

# Security Group for EmailAI Application Servers (only create if not using existing VPC)
resource "aws_security_group" "emailai" {
  count       = local.create_new ? 1 : 0
  name        = "${var.project_name}-${var.environment}-emailai-sg"
  description = "Security group for EmailAI application servers"
  vpc_id      = local.vpc_id

  # Application port from ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb[0].id]
  }

  # LLM API proxy port from ALB
  ingress {
    description     = "LLM API proxy from ALB"
    from_port       = 8001
    to_port         = 8001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb[0].id]
  }

  # SSH (not needed - using SSM)
  # ingress {
  #   description = "SSH"
  #   from_port   = 22
  #   to_port     = 22
  #   protocol    = "tcp"
  #   cidr_blocks = var.allowed_ssh_cidrs
  # }

  # All outbound traffic (for API calls, database, etc.)
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-emailai-sg"
  }
}
