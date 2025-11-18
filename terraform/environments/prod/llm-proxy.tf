# LLM API reverse proxy configuration
# Adds HTTPS endpoint for LLM (Ollama) via ALB at /llm path

# ALB listener rule for /llm path (uses existing emailai.calldata.app certificate)
resource "aws_lb_listener_rule" "llm" {
  listener_arn = module.alb.https_listener_arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.llm_proxy.arn
  }

  condition {
    path_pattern {
      values = ["/llm*"]
    }
  }

  priority = 100
}

# Target group for LLM proxy (routes to EC2 instances running nginx proxy)
resource "aws_lb_target_group" "llm_proxy" {
  name     = "${var.project_name}-${var.environment}-llm-tg"
  port     = 8001 # nginx will listen on port 8001 for LLM proxy
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200,502" # 502 is OK if Vast.ai is temporarily down
    path                = "/llm/api/tags"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-llm-tg"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Attach emailai instances to LLM proxy target group
resource "aws_lb_target_group_attachment" "llm_proxy" {
  count            = var.instance_count
  target_group_arn = aws_lb_target_group.llm_proxy.arn
  target_id        = module.emailai_servers.instance_ids[count.index]
  port             = 8001
}

# Output the LLM HTTPS URL
output "llm_https_url" {
  description = "HTTPS URL for LLM API via ALB (path-based routing)"
  value       = var.certificate_arn != "" ? "https://${module.alb.alb_dns_name}/llm/api" : "http://${module.alb.alb_dns_name}/llm/api"
}
