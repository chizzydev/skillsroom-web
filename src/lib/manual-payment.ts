export const manualCollectionAccount = {
  bankName: "Opay",
  accountNumber: "8134979631",
  accountName: "Chizaram Anthony Chukwuka"
} as const;

export const manualCollectionPolicy = {
  title: "Bank transfer",
  summary:
    "Send the exact amount to the account below. Your payment will be checked before it becomes available.",
  instructions: [
    "Transfer the exact amount to the collection account shown below.",
    "Use your room code or tournament title in the transfer narration if your bank app allows it.",
    "Upload the transfer screenshot and add the transfer reference so we can confirm it quickly."
  ]
} as const;
