"use client";

import { ProfileImage } from "@/components/ProfileImage";
import { getCreatorDisplayInfo } from "@/utils/organization/sharing";

interface CreatorInfoProps {
  creator?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  label?: string;
  className?: string;
}

export function CreatorInfo({
  creator,
  label = "Created by",
  className,
}: CreatorInfoProps) {
  if (!creator) {
    return null;
  }

  const displayName = getCreatorDisplayInfo(creator);

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      <span className="text-gray-500">{label}:</span>
      <div className="flex items-center gap-1.5">
        <ProfileImage
          imageUrl={creator.image}
          name={displayName}
          size="xs"
        />
        <span className="font-medium">{displayName}</span>
      </div>
    </div>
  );
}
