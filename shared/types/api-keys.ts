// Tipi condivisi per le API Keys tra client e server
export interface ApiKeys {
  openai?: string;
  azure?: {
    apiKey: string;
    // Ogni modello Azure può avere un resourceName diverso
    deployments?: {
      [modelId: string]: {
        resourceName: string;
        deploymentName?: string; // Nome del deployment se diverso dal modelId
      };
    };
  };
  anthropic?: string;
  openrouter?: string;
  google?: string;
  deepseek?: string;
  xai?: string;
}
