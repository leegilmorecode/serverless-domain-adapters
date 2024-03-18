export type Event = {
  created: string;
  detail: {
    metadata: {
      domain: string;
      source: string;
      type: string;
      id: string;
    };
    data: Record<string, any>;
  };
};
