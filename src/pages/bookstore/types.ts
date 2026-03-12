export interface Product {
    id: string;
    name: string;
    code?: string;
    category?: string;
    isVisible: boolean;
    createdAt?: any;
}

export interface Category {
    id: string;
    name: string;
    createdAt?: any;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface RequestOrder {
    id: string;
    branch: string;
    userEmail: string;
    status: string;
    createdAt: any;
    note?: string;
    items: {
        productId: string;
        name: string;
        code: string;
        quantity: number;
    }[];
}

export const branches = [
    "Bukz Las Lomas",
    "Bukz Viva Envigado",
    "Bukz Museo",
    "Bukz Cedi",
    "Bukz Administrativo",
    "Bukz Bogota 109",
];
