import {
    ShoppingCart,
    Package,
    Send,
    Search,
    StickyNote,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Product, CartItem } from "./types";

interface BookstoreOrderViewProps {
    products: Product[];
    cart: CartItem[];
    selectedBranch: string;
    setSelectedBranch: (branch: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    orderNote: string;
    setOrderNote: (note: string) => void;
    updateCart: (product: Product, quantity: number) => void;
    handleSubmitOrder: () => void;
    isSubmitting: boolean;
    branches: string[];
}

const BookstoreOrderView = ({
    products,
    cart,
    selectedBranch,
    setSelectedBranch,
    searchQuery,
    setSearchQuery,
    orderNote,
    setOrderNote,
    updateCart,
    handleSubmitOrder,
    isSubmitting,
    branches,
}: BookstoreOrderViewProps) => (
    <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Realizar Pedido</CardTitle>
                    <CardDescription>Selecciona los productos que necesitas para tu sede</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Sede Solicitante</label>
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona tu sede..." />
                            </SelectTrigger>
                            <SelectContent>
                                {branches.map((branch) => (
                                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator />

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
                        {products.filter(p => p.isVisible)
                            .filter(p => {
                                if (!searchQuery.trim()) return true;
                                const q = searchQuery.toLowerCase();
                                return p.name.toLowerCase().includes(q) ||
                                    (p.code && p.code.toLowerCase().includes(q)) ||
                                    (p.category && p.category.toLowerCase().includes(q));
                            })
                            .map((product) => {
                                const quantity = cart.find(i => i.id === product.id)?.quantity || 0;
                                return (
                                    <div key={product.id} className="flex flex-col gap-2 p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <span className="font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</span>
                                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                        </div>
                                        <div className="flex items-center justify-between mt-auto pt-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground">{product.category}</span>
                                                {product.code && <span className="text-[10px] text-muted-foreground">Ref: {product.code}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md hover:bg-background"
                                                    onClick={() => updateCart(product, quantity - 1)}
                                                    disabled={quantity === 0}
                                                >
                                                    -
                                                </Button>
                                                <span className="w-8 text-center font-medium text-sm">{quantity}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md hover:bg-background"
                                                    onClick={() => updateCart(product, quantity + 1)}
                                                >
                                                    +
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="bg-primary/5 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Resumen del Pedido
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>Tu carrito está vacío</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <span className="truncate flex-1 pr-2">{item.name}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline">x{item.quantity}</Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                onClick={() => updateCart(item, 0)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Separator className="my-2" />
                                <div className="flex justify-between font-medium">
                                    <span>Total Ítems</span>
                                    <span>{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                                Nota (opcional)
                            </label>
                            <Textarea
                                placeholder="Agrega una nota o comentario a tu pedido..."
                                value={orderNote}
                                onChange={(e) => setOrderNote(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />
                        </div>

                        <Button
                            className="w-full mt-4"
                            size="lg"
                            disabled={cart.length === 0 || !selectedBranch || isSubmitting}
                            onClick={handleSubmitOrder}
                        >
                            {isSubmitting ? (
                                "Enviando..."
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" /> Enviar Solicitud
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
);

export default BookstoreOrderView;
