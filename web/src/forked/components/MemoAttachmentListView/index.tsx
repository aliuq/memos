import { memo, useMemo } from "react";
import MemoAttachment from "@/components/MemoAttachment";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType } from "@/utils/attachment";
import MediaList from "./components/MediaList";

const OtherList = memo(function OtherList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="w-full flex flex-row justify-start overflow-auto gap-2">
      {attachments.map((attachment) => (
        <MemoAttachment key={attachment.name} attachment={attachment} />
      ))}
    </div>
  );
});

const MemoAttachmentListView = ({ attachments = [] }: { attachments: Attachment[] }) => {
  const { mediaAttachments, otherAttachments } = useMemo(() => {
    const media: Attachment[] = [];
    const other: Attachment[] = [];

    attachments.forEach((attachment) => {
      const type = getAttachmentType(attachment);
      if (type === "image/*" || type === "video/*") {
        media.push(attachment);
      } else {
        other.push(attachment);
      }
    });

    return { mediaAttachments: media, otherAttachments: other };
  }, [attachments]);

  return (
    <>
      {mediaAttachments.length > 0 && <MediaList attachments={mediaAttachments} />}
      <OtherList attachments={otherAttachments} />
    </>
  );
};

export default memo(MemoAttachmentListView);
