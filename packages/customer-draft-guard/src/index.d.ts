export type TemplateField = Readonly<{
  name: string;
  suggestion: string | null;
  start: number;
  end: number;
}>;

export type TemplateInspection = Readonly<{
  fields: ReadonlyArray<TemplateField>;
  names: ReadonlyArray<string>;
}>;

export declare class TemplateFormatError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export declare function inspectTemplate(
  template: string,
  options?: { requiredFields?: string[] },
): TemplateInspection;

export type CustomerDraftCheck = Readonly<{
  ok: boolean;
  reason: 'invalid-input' | 'empty' | 'too-long' | 'unresolved-fields' | null;
}>;

export declare function checkCustomerDraft(
  text: unknown,
  options?: { maxLength?: number },
): CustomerDraftCheck;
