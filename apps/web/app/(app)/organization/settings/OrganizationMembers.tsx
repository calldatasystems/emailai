"use client";

import { useState } from "react";
import useSWR from "swr";
import { useOrganization } from "@/providers/OrganizationProvider";
import type { OrganizationMember } from "@/providers/OrganizationProvider";
import { Button } from "@/components/Button";
import { LoadingContent } from "@/components/LoadingContent";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, UserPlus, Trash2 } from "lucide-react";
import { fetcher } from "@/utils/swr";
import { useToast } from "@/components/ui/use-toast";
import { can } from "@/utils/organization/rbac";
import type { OrganizationRole } from "@prisma/client";

export function OrganizationMembers() {
  const { organizationId, organizationRole } = useOrganization();
  const { toast } = useToast();
  const [isInviting, setIsInviting] = useState(false);

  const {
    data: members,
    isLoading,
    error,
    mutate,
  } = useSWR<OrganizationMember[]>(
    organizationId ? `/api/organization/${organizationId}/members` : null,
    fetcher,
  );

  const canInvite = organizationRole ? can.inviteMembers(organizationRole) : false;
  const canManage = organizationRole ? can.removeMembers(organizationRole) : false;

  const handleRemoveMember = async (memberId: string) => {
    if (!organizationId) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const response = await fetch(
        `/api/organization/${organizationId}/members/${memberId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      toast({
        title: "Member removed",
        description: "The member has been removed from the organization.",
      });

      mutate();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member.",
        variant: "destructive",
      });
    }
  };

  const handleInviteMember = async () => {
    // TODO: Implement invite modal
    toast({
      title: "Coming soon",
      description: "Member invitation feature is coming soon.",
    });
  };

  const getRoleBadgeColor = (role: OrganizationRole) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 text-purple-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "MEMBER":
        return "bg-green-100 text-green-800";
      case "VIEWER":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage who has access to this organization.
          </p>
        </div>
        {canInvite && (
          <Button onClick={handleInviteMember} loading={isInviting}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <LoadingContent loading={isLoading} error={error}>
        {members && members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {canManage && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name || member.email}
                          className="mr-3 h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="mr-3 h-8 w-8 rounded-full bg-gray-200" />
                      )}
                      <span className="font-medium">
                        {member.name || "Unnamed User"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {member.email}
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(member.role)}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {member.role !== "OWNER" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-8 text-center text-gray-500">
            No members found.
          </div>
        )}
      </LoadingContent>
    </Card>
  );
}
