"use client";

import React from "react";
import { ChevronsUpDown, Check, Building2, Plus } from "lucide-react";
import { useOrganizationSwitcher } from "@/providers/OrganizationProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/Button";
import { cn } from "@/utils";

interface OrganizationSwitcherProps {
  className?: string;
}

export function OrganizationSwitcher({
  className,
}: OrganizationSwitcherProps) {
  const {
    organizations,
    isLoadingOrganizations,
    switchOrganization,
    isSwitching,
    currentOrganizationId,
  } = useOrganizationSwitcher();

  const currentOrg = organizations.find(
    (org) => org.id === currentOrganizationId,
  );

  const handleSwitchOrganization = async (organizationId: string) => {
    if (organizationId === currentOrganizationId) return;
    try {
      await switchOrganization(organizationId);
    } catch (error) {
      console.error("Failed to switch organization:", error);
      // TODO: Show error toast
    }
  };

  if (isLoadingOrganizations) {
    return (
      <Button disabled className={className}>
        <Building2 className="mr-2 h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  if (!currentOrg) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isSwitching}
          className={cn(
            "w-full justify-between px-2",
            isSwitching && "opacity-50",
            className,
          )}
        >
          <div className="flex items-center overflow-hidden">
            {currentOrg.logoUrl ? (
              <img
                src={currentOrg.logoUrl}
                alt={currentOrg.name}
                className="mr-2 h-6 w-6 rounded"
              />
            ) : (
              <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate text-sm font-medium">
              {currentOrg.name}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-xs font-normal text-gray-500">
          Organizations
        </DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitchOrganization(org.id)}
            className="cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center overflow-hidden">
                {org.logoUrl ? (
                  <img
                    src={org.logoUrl}
                    alt={org.name}
                    className="mr-2 h-5 w-5 rounded"
                  />
                ) : (
                  <Building2 className="mr-2 h-4 w-4 flex-shrink-0" />
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">
                    {org.name}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {org.role}
                  </span>
                </div>
              </div>
              {org.id === currentOrganizationId && (
                <Check className="ml-2 h-4 w-4 flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          <span className="text-sm">Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
