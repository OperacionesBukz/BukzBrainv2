import {
    Trash2,
    History,
    Eye,
    Calendar,
    StickyNote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import StatusDropdown from "@/components/StatusDropdown";
import { RequestOrder, OrderStatus, ORDER_STATUS_CONFIG } from "./types";

interface BookstoreOrderHistoryProps {
    orders: RequestOrder[];
    selectedOrder: RequestOrder | null;
    setSelectedOrder: (order: RequestOrder | null) => void;
    handleDeleteOrder: (orderId: string) => void;
    handleStatusChange: (orderId: string, newStatus: OrderStatus) => void;
    isDeletingOrder: string | null;
    isMobile: boolean;
    formatDate: (timestamp: { toDate: () => Date } | null | undefined) => string;
}

const BookstoreOrderHistory = ({
    orders,
    selectedOrder,
    setSelectedOrder,
    handleDeleteOrder,
    handleStatusChange,
    isDeletingOrder,
    isMobile,
    formatDate,
}: BookstoreOrderHistoryProps) => (
    <Card>
        <CardHeader>
            <CardTitle>Historial de Pedidos</CardTitle>
            <CardDescription>Seguimiento de solicitudes recibidas</CardDescription>
        </CardHeader>
        <CardContent>
            {!isMobile ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead className="text-center">Total Items</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => {
                            const totalItems = order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
                            return (
                                <TableRow key={order.id}>
                                    <TableCell className="whitespace-nowrap flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {formatDate(order.createdAt)}
                                    </TableCell>
                                    <TableCell>{order.branch}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{order.userEmail}</TableCell>
                                    <TableCell className="text-center font-medium">{totalItems}</TableCell>
                                    <TableCell>
                                        <StatusDropdown
                                            statusConfig={ORDER_STATUS_CONFIG}
                                            currentStatus={order.status}
                                            onStatusChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteOrder(order.id)}
                                                disabled={isDeletingOrder === order.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            ) : (
                <div className="space-y-3">
                    {orders.map((order) => {
                        const totalItems = order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
                        return (
                            <div key={order.id} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium text-foreground">
                                            {formatDate(order.createdAt)}
                                        </span>
                                    </div>
                                    <StatusDropdown
                                        statusConfig={ORDER_STATUS_CONFIG}
                                        currentStatus={order.status}
                                        onStatusChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                                        align="end"
                                    />
                                </div>

                                <div className="text-sm space-y-1.5">
                                    <div>
                                        <span className="text-muted-foreground text-xs">Sede:</span>{" "}
                                        <span className="font-medium text-foreground">{order.branch}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs">Solicitante:</span>{" "}
                                        <span className="text-foreground text-xs">{order.userEmail}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs">Total Items:</span>{" "}
                                        <span className="font-medium text-foreground">{totalItems}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 gap-2 text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteOrder(order.id)}
                                        disabled={isDeletingOrder === order.id}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        {isDeletingOrder === order.id ? "Eliminando..." : "Eliminar"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedOrder(order)}
                                        className="h-9 px-3 gap-2"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Ver Detalles
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {orders.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No hay pedidos registrados</p>
                </div>
            )}
        </CardContent>

        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Detalle del Pedido</DialogTitle>
                    <CardDescription>{selectedOrder?.branch} - {formatDate(selectedOrder?.createdAt)}</CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-1 text-sm bg-muted/30 p-3 rounded-lg">
                        <p><span className="font-semibold">Solicitante:</span> {selectedOrder?.userEmail}</p>
                        <p><span className="font-semibold">ID Pedido:</span> {selectedOrder?.id.slice(0, 8)}</p>
                        <div className="flex items-center gap-2 pt-1">
                            <span className="font-semibold">Estado:</span>
                            {selectedOrder && (
                                <StatusDropdown
                                    statusConfig={ORDER_STATUS_CONFIG}
                                    currentStatus={selectedOrder.status}
                                    onStatusChange={(newStatus) => handleStatusChange(selectedOrder.id, newStatus)}
                                />
                            )}
                        </div>
                    </div>

                    {selectedOrder?.note && (
                        <div className="text-sm bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
                            <p className="font-semibold flex items-center gap-2 mb-1">
                                <StickyNote className="h-4 w-4" /> Nota
                            </p>
                            <p className="text-muted-foreground">{selectedOrder.note}</p>
                        </div>
                    )}

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Cant.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedOrder?.items?.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{item.name}</span>
                                                {item.code && <span className="text-xs text-muted-foreground">Ref: {item.code}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <DialogFooter className="sm:justify-between gap-2">
                    <Button
                        variant="destructive"
                        onClick={() => selectedOrder && handleDeleteOrder(selectedOrder.id)}
                        disabled={isDeletingOrder === selectedOrder?.id}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeletingOrder === selectedOrder?.id ? "Eliminando..." : "Eliminar Pedido"}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Card>
);

export default BookstoreOrderHistory;
