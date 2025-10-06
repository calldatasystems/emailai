"use client";

import { Users, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/Tooltip";
import { getSharingStatus } from "@/utils/organization/sharing";

interface SharedResourceBadgeProps {
  isShared?: boolean;
  className?: string;
}

export function SharedResourceBadge({
  isShared,
  className,
}: SharedResourceBadgeProps) {
  const status = getSharingStatus(isShared);

  return (
    <Tooltip content={status.description}>
      <Badge variant={status.variant} className={className}>
        {isShared ? (
          <Users className="mr-1 h-3 w-3" />
        ) : (
          <Lock className="mr-1 h-3 w-3" />
        )}
        {status.label}
      </Badge>
    </Tooltip>
  );
}
