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

import { Clock4, Package, CheckCircle2 } from "lucide-react";
import type { StatusOption } from "@/components/StatusDropdown";

export type OrderStatus = "pending" | "requested" | "delivered";

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusOption> = {
    pending: {
        label: "Pendiente",
        icon: Clock4,
        iconClassName: "text-amber-500",
        badgeVariant: "secondary",
    },
    requested: {
        label: "Solicitado",
        icon: Package,
        iconClassName: "text-blue-500",
        badgeVariant: "default",
    },
    delivered: {
        label: "Entregado",
        icon: CheckCircle2,
        iconClassName: "text-green-500",
        badgeVariant: "outline",
        badgeClassName: "border-green-500 text-green-600 dark:text-green-400",
    },
};

export interface RequestOrder {
    id: string;
    branch: string;
    userEmail: string;
    status: OrderStatus;
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
