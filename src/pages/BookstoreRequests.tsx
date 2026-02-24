
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    doc,
    updateDoc,
    getDocs,
    limit,
    Timestamp
} from "firebase/firestore";
import { toast } from "sonner";
import {
    Building2,
    ShoppingCart,
    Plus,
    Trash2,
    Save,
    Package,
    Send,
    History,
    Store,
    Pencil,
    X,
    Check,
    Calendar,
    Eye,
    Search,
    StickyNote
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Product {
    id: string;
    name: string;
    code?: string;
    category?: string;
    isVisible: boolean;
    createdAt?: any;
}

interface Category {
    id: string;
    name: string;
    createdAt?: any;
}

interface CartItem extends Product {
    quantity: number;
}

interface RequestOrder {
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

const branches = [
    "Bukz Las Lomas",
    "Bukz Viva Envigado",
    "Bukz Museo",
    "Bukz Cedi",
    "Bukz Administrativo",
    "Bukz Bogota 109",
];

const BookstoreRequests = () => {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]); // New state for backend categories
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [activeTab, setActiveTab] = useState("order");
    const [searchQuery, setSearchQuery] = useState("");
    const [orderNote, setOrderNote] = useState("");

    // Operations Management State
    const [newProductName, setNewProductName] = useState("");
    const [newProductCode, setNewProductCode] = useState("");
    const [newProductCategory, setNewProductCategory] = useState("General");
    const [newCategoryName, setNewCategoryName] = useState(""); // State for new category input

    // Edit States
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editForm, setEditForm] = useState({ name: "", code: "", category: "" });

    // Request Orders State
    const [orders, setOrders] = useState<RequestOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<RequestOrder | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeletingOrder, setIsDeletingOrder] = useState<string | null>(null);

    const { isAdmin } = useAuth();
    const isOperations = isAdmin;

    // Fetch Products (Alphabetical Order is ensured by query)
    useEffect(() => {
        const q = query(collection(db, "products"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];
            setProducts(docs);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Categories
    useEffect(() => {
        const q = query(collection(db, "product_categories"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Category[];
            setCategories(docs);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Orders for Operations
    useEffect(() => {
        if (!isOperations) return;

        const q = query(
            collection(db, "bookstore_requests"),
            orderBy("createdAt", "desc"),
            limit(50) // Limit to recent 50 orders for now
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RequestOrder[];
            setOrders(docs);
        });
        return () => unsubscribe();
    }, [isOperations]);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await addDoc(collection(db, "product_categories"), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp(),
            });
            setNewCategoryName("");
            toast.success("Categoría agregada");
        } catch (error) {
            toast.error("Error al agregar categoría");
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("¿Eliminar esta categoría?")) return;
        try {
            await deleteDoc(doc(db, "product_categories", id));
            toast.success("Categoría eliminada");
        } catch (error) {
            toast.error("Error al eliminar categoría");
        }
    };

    const handleAddProduct = async () => {
        if (!newProductName.trim()) return;
        try {
            await addDoc(collection(db, "products"), {
                name: newProductName.trim(),
                code: newProductCode.trim(),
                category: newProductCategory,
                isVisible: true,
                createdAt: serverTimestamp(),
            });
            setNewProductName("");
            setNewProductCode("");
            toast.success("Producto agregado correctamente");
        } catch (error) {
            console.error("Error adding product:", error);
            toast.error("Error al agregar producto");
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este producto?")) return;
        try {
            await deleteDoc(doc(db, "products", id));
            toast.success("Producto eliminado");
        } catch (error) {
            toast.error("Error al eliminar producto");
        }
    };

    const handleToggleVisibility = async (product: Product) => {
        try {
            await updateDoc(doc(db, "products", product.id), {
                isVisible: !product.isVisible
            });
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    const startEditing = (product: Product) => {
        setEditingProduct(product);
        setEditForm({
            name: product.name,
            code: product.code || "",
            category: product.category || "General"
        });
    };

    const saveEdit = async () => {
        if (!editingProduct) return;
        try {
            await updateDoc(doc(db, "products", editingProduct.id), {
                name: editForm.name,
                code: editForm.code,
                category: editForm.category
            });
            setEditingProduct(null);
            toast.success("Producto actualizado");
        } catch (error) {
            toast.error("Error al actualizar producto");
        }
    };

    const updateCart = (product: Product, quantity: number) => {
        if (quantity < 0) return;

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (quantity === 0) {
                return prev.filter(item => item.id !== product.id);
            }
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity } : item);
            }
            return [...prev, { ...product, quantity }];
        });
    };

    const handleSubmitOrder = async () => {
        if (!selectedBranch) {
            toast.error("Por favor selecciona una sede");
            return;
        }
        if (cart.length === 0) {
            toast.error("El carrito está vacío");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Save to Firestore
            const orderData = {
                branch: selectedBranch,
                userEmail: user?.email,
                items: cart.map(item => ({
                    productId: item.id,
                    name: item.name,
                    code: item.code || "",
                    quantity: item.quantity
                })),
                note: orderNote.trim(),
                status: "pending",
                createdAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, "bookstore_requests"), orderData);

            // 2. Send Email
            const itemsTableRows = cart.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}${item.code ? ` <span style="color: #666; font-size: 12px;">(${item.code})</span>` : ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        </tr>
      `).join("");

            const emailBody = `
        <h3>Nueva Solicitud de Librería</h3>
        <p><b>Sede:</b> ${selectedBranch}</p>
        <p><b>Solicitante:</b> ${user?.email}</p>
        <p><b>Fecha:</b> ${new Date().toLocaleDateString()}</p>
        ${orderNote.trim() ? `<p><b>Nota:</b> ${orderNote.trim()}</p>` : ''}
        <br/>
        <table style="width: 100%; border-collapse: collapse; max-width: 600px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Producto</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableRows}
          </tbody>
        </table>
      `;

            await fetch("https://Operaciones.pythonanywhere.com/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipient_email: "operaciones@bukz.co", // Explicitly added based on request
                    userEmail: user?.email, // Keep this for context if backend uses it
                    type_label: "Solicitud Librería",
                    subject: `Solicitud Librería - ${selectedBranch}`,
                    email_body: emailBody
                }),
            });

            toast.success("Solicitud enviada exitosamente a Operaciones");
            setCart([]);
            setSelectedBranch("");
            setOrderNote("");

        } catch (error: any) {
            console.error("Error submitting order:", error);
            toast.error("Error al enviar la solicitud: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate();
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm("¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.")) return;
        setIsDeletingOrder(orderId);
        try {
            await deleteDoc(doc(db, "bookstore_requests", orderId));
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
            toast.success("Pedido eliminado correctamente");
        } catch (error: any) {
            toast.error("Error al eliminar el pedido: " + error.message);
        } finally {
            setIsDeletingOrder(null);
        }
    };

    const renderOperationsOrdersView = () => (
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
                                            <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
                                                {order.status === 'pending' ? 'Pendiente' : order.status}
                                            </Badge>
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
                                        <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
                                            {order.status === 'pending' ? 'Pendiente' : order.status}
                                        </Badge>
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

    const renderOperationsManagementView = () => (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                {/* Manage Categories */}
                <Card>
                    <CardHeader>
                        <CardTitle>Categorías</CardTitle>
                        <CardDescription>Gestiona las categorías de productos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="Nueva categoría..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                            <Button size="icon" onClick={handleAddCategory}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center bg-muted/40 p-2 rounded-md">
                                    <span className="text-sm">{cat.name}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            {categories.length === 0 && <p className="text-xs text-muted-foreground text-center">No hay categorías. Agrega una arriba.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Add Product */}
                <Card>
                    <CardHeader>
                        <CardTitle>Nuevo Producto</CardTitle>
                        <CardDescription>Agrega un nuevo producto al catálogo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Input
                                value={newProductName}
                                onChange={(e) => setNewProductName(e.target.value)}
                                placeholder="Nombre del producto..."
                            />
                            <div className="flex gap-2">
                                <Input
                                    value={newProductCode}
                                    onChange={(e) => setNewProductCode(e.target.value)}
                                    placeholder="Código (opcional)"
                                    className="w-1/3"
                                />
                                <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="General">General</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddProduct} className="w-full">
                                <Plus className="h-4 w-4 mr-2" /> Agregar Producto
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Catálogo de Productos ({products.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {products.map((product) => (
                            <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2 w-2 rounded-full ${product.isVisible ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <div>
                                        <div className="font-medium">{product.name}</div>
                                        {product.code && <div className="text-xs text-muted-foreground">Cód: {product.code}</div>}
                                    </div>
                                    <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleVisibility(product)}
                                    >
                                        {product.isVisible ? 'Ocultar' : 'Mostrar'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => startEditing(product)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteProduct(product.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Producto</DialogTitle>
                    </DialogHeader>
                    {editingProduct && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre</label>
                                <Input
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Código</label>
                                    <Input
                                        value={editForm.code}
                                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Categoría</label>
                                    <Select
                                        value={editForm.category}
                                        onValueChange={(val) => setEditForm({ ...editForm, category: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="General">General</SelectItem>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
                        <Button onClick={saveEdit}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    const renderBookstoreView = () => (
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Solicitud de Librerías</h1>
                <p className="mt-1 text-base text-muted-foreground">
                    {isOperations ? 'Gestiona el catálogo de productos y categorías' : 'Realiza solicitudes de insumos y productos para tu sede'}
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted/50 p-1 mb-6">
                    <TabsTrigger value="order" className="gap-2">
                        <Store className="h-4 w-4" />
                        Nuevo Pedido
                    </TabsTrigger>
                    {isOperations && (
                        <>
                            <TabsTrigger value="history" className="gap-2">
                                <History className="h-4 w-4" />
                                Historial de Pedidos
                            </TabsTrigger>
                            <TabsTrigger value="products" className="gap-2">
                                <Package className="h-4 w-4" />
                                Productos y Categorías
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <TabsContent value="order" className="mt-0">
                    {renderBookstoreView()}
                </TabsContent>

                {isOperations && (
                    <>
                        <TabsContent value="history" className="mt-0">
                            {renderOperationsOrdersView()}
                        </TabsContent>
                        <TabsContent value="products" className="mt-0">
                            {renderOperationsManagementView()}
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
};

export default BookstoreRequests;
