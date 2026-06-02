/** Wire-format element block (shared by attachment + composer segment model). */
export function browserElementContextText(attachment: {
  pageUrl: string;
  outerHtml: string;
}): string {
  return `Selected element from ${attachment.pageUrl}:\n\`\`\`html\n${attachment.outerHtml}\n\`\`\``;
}
