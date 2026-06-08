export const manualCollectionAccount = {
  bankName: "Opay",
  accountNumber: "8149055775",
  accountName: "Damilola Emmanuel Fagbemi"
} as const;

export const manualCollectionPolicy = {
  title: "Closed beta manual collection",
  summary:
    "Skillsroom is using a controlled manual collection rail for closed beta while split payments stay paused pending product validation.",
  instructions: [
    "Transfer the exact amount to the collection account shown below.",
    "Use your room code or tournament title in the transfer narration if your bank app allows it.",
    "Upload the transfer screenshot and add the transfer reference so operators can reconcile quickly."
  ]
} as const;
