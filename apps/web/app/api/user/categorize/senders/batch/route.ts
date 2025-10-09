import { withError } from "@/utils/middleware";
import { withQStashVerification } from "@/utils/qstash";
import { handleBatchRequest } from "@/app/api/user/categorize/senders/batch/handle-batch";

export const maxDuration = 300;

export const POST = withError(withQStashVerification(handleBatchRequest));
