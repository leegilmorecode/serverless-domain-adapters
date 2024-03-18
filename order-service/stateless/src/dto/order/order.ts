export type Order = {
  id?: string;
  created?: string;
  orderNumber: string;
  customerId: string;
  totalValue: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
};
