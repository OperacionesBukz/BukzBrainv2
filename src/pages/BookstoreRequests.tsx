
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
import { resilientFetch } from "@/lib/resilient-fetch";
import {
    Store,
    History,
    Package
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Product, Category, CartItem, RequestOrder, OrderStatus, branches } from "./bookstore/types";
import BookstoreOrderView from "./bookstore/BookstoreOrderView";
import BookstoreOrderHistory from "./bookstore/BookstoreOrderHistory";
import BookstoreProductManagement from "./bookstore/BookstoreProductManagement";

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
          <td style="padding: 8px; border: 1px solid #ddd;">${item.code || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
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
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Código</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Producto</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableRows}
          </tbody>
        </table>
      `;

            const API_URL = import.meta.env.VITE_API_URL ?? "https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host";
            await resilientFetch(`${API_URL}/api/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to_email: "operaciones@bukz.co",
                    userEmail: user?.email,
                    subject: `Solicitud Librería - ${selectedBranch}`,
                    email_body: emailBody
                }),
            });

            toast.success("Solicitud enviada exitosamente a Operaciones");
            setCart([]);
            setSelectedBranch("");
            setOrderNote("");

        } catch (error) {
            console.error("Error submitting order:", error);
            toast.error("Error al enviar la solicitud: " + (error instanceof Error ? error.message : "Error desconocido"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (timestamp: { toDate: () => Date } | null | undefined) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate();
        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        try {
            await updateDoc(doc(db, "bookstore_requests", orderId), { status: newStatus });
            toast.success("Estado actualizado");
        } catch (error) {
            toast.error("Error al actualizar estado: " + (error instanceof Error ? error.message : "Error desconocido"));
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm("¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.")) return;
        setIsDeletingOrder(orderId);
        try {
            await deleteDoc(doc(db, "bookstore_requests", orderId));
            if (selectedOrder?.id === orderId) setSelectedOrder(null);
            toast.success("Pedido eliminado correctamente");
        } catch (error) {
            toast.error("Error al eliminar el pedido: " + (error instanceof Error ? error.message : "Error desconocido"));
        } finally {
            setIsDeletingOrder(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Solicitud de Librerías</h1>
                <p className="mt-1 text-base text-muted-foreground">
                    {isOperations ? 'Gestiona el catálogo de productos y categorías' : 'Realiza solicitudes de insumos y productos para tu sede'}
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6">
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
                    <BookstoreOrderView
                        products={products}
                        cart={cart}
                        selectedBranch={selectedBranch}
                        setSelectedBranch={setSelectedBranch}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        orderNote={orderNote}
                        setOrderNote={setOrderNote}
                        updateCart={updateCart}
                        handleSubmitOrder={handleSubmitOrder}
                        isSubmitting={isSubmitting}
                        branches={branches}
                    />
                </TabsContent>

                {isOperations && (
                    <>
                        <TabsContent value="history" className="mt-0">
                            <BookstoreOrderHistory
                                orders={orders}
                                selectedOrder={selectedOrder}
                                setSelectedOrder={setSelectedOrder}
                                handleDeleteOrder={handleDeleteOrder}
                                handleStatusChange={handleStatusChange}
                                isDeletingOrder={isDeletingOrder}
                                isMobile={isMobile}
                                formatDate={formatDate}
                            />
                        </TabsContent>
                        <TabsContent value="products" className="mt-0">
                            <BookstoreProductManagement
                                products={products}
                                categories={categories}
                                newProductName={newProductName}
                                setNewProductName={setNewProductName}
                                newProductCode={newProductCode}
                                setNewProductCode={setNewProductCode}
                                newProductCategory={newProductCategory}
                                setNewProductCategory={setNewProductCategory}
                                newCategoryName={newCategoryName}
                                setNewCategoryName={setNewCategoryName}
                                handleAddProduct={handleAddProduct}
                                handleDeleteProduct={handleDeleteProduct}
                                handleAddCategory={handleAddCategory}
                                handleDeleteCategory={handleDeleteCategory}
                                handleToggleVisibility={handleToggleVisibility}
                                startEditing={startEditing}
                                editingProduct={editingProduct}
                                setEditingProduct={setEditingProduct}
                                editForm={editForm}
                                setEditForm={setEditForm}
                                saveEdit={saveEdit}
                            />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
};

export default BookstoreRequests;
