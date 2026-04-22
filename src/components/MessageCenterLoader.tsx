"use client"; // This is the magic line

import dynamic from "next/dynamic";

// We move the dynamic import here
const MessageCenterClient = dynamic(
  () => import("./MessageCenterClient"),
  { ssr: false }
);

export default MessageCenterClient;