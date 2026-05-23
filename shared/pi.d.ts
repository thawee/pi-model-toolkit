// shared/pi.d.ts
// Ambient module declarations for @earendil-works/pi-coding-agent

declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionAPI {
    registerCommand(
      name: string,
      config: {
        description: string;
        detailedHelp?: string;
        handler: (args: string, ctx: any) => Promise<void> | void;
      }
    ): void;
    registerTool(config: {
      name: string;
      label?: string;
      description: string;
      parameters: any;
      execute: (...args: any[]) => Promise<any> | any;
    }): void;
    registerProvider(
      name: string,
      config: {
        baseUrl: string;
        api: string;
        apiKey?: string;
        compat?: any;
        models: any[];
      }
    ): void;
    on(
      event: "model_select" | string,
      callback: (event: any, ctx: any) => Promise<void> | void
    ): void;
    sendMessage(msg: any): void;
    setModel(model: any): Promise<boolean>;
  }
}
