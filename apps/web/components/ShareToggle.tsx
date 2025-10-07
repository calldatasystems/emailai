"use client";

import { useState } from "react";
import { Users, Lock } from "lucide-react";
import { Button } from "@/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

interface ShareToggleProps {
  resourceId: string;
  resourceType: "rule" | "group" | "knowledge" | "category";
  isShared: boolean;
  onToggle: (isShared: boolean) => Promise<void>;
  canShare: boolean;
  className?: string;
}

export function ShareToggle({
  resourceId,
  resourceType,
  isShared,
  onToggle,
  canShare,
  className,
}: ShareToggleProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (newIsShared: boolean) => {
    if (!canShare) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to change sharing settings",
        variant: "destructive",
      });
      return;
    }

    setIsToggling(true);
    try {
      await onToggle(newIsShared);
      toast({
        title: "Sharing updated",
        description: newIsShared
          ? `This ${resourceType} is now visible to all organization members`
          : `This ${resourceType} is now private`,
      });
    } catch (error) {
      console.error("Error toggling share:", error);
      toast({
        title: "Error",
        description: "Failed to update sharing settings",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  if (!canShare) {
    return (
      <Button size="sm" disabled className={className}>
        {isShared ? (
          <>
            <Users className="mr-2 h-4 w-4" />
            Shared
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Private
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={isToggling}
          className={className}
        >
          {isShared ? (
            <>
              <Users className="mr-2 h-4 w-4" />
              Shared
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Private
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sharing</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleToggle(true)}>
          <Users className="mr-2 h-4 w-4" />
          <div>
            <div className="font-medium">Shared with organization</div>
            <div className="text-xs text-gray-500">
              All members can view and use
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggle(false)}>
          <Lock className="mr-2 h-4 w-4" />
          <div>
            <div className="font-medium">Private</div>
            <div className="text-xs text-gray-500">Only you can access</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
