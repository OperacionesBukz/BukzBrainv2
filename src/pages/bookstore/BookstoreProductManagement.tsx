import {
    Plus,
    Trash2,
    Pencil,
    X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Product, Category } from "./types";

interface BookstoreProductManagementProps {
    products: Product[];
    categories: Category[];
    newProductName: string;
    setNewProductName: (name: string) => void;
    newProductCode: string;
    setNewProductCode: (code: string) => void;
    newProductCategory: string;
    setNewProductCategory: (category: string) => void;
    newCategoryName: string;
    setNewCategoryName: (name: string) => void;
    handleAddProduct: () => void;
    handleDeleteProduct: (id: string) => void;
    handleAddCategory: () => void;
    handleDeleteCategory: (id: string) => void;
    handleToggleVisibility: (product: Product) => void;
    startEditing: (product: Product) => void;
    editingProduct: Product | null;
    setEditingProduct: (product: Product | null) => void;
    editForm: { name: string; code: string; category: string };
    setEditForm: (form: { name: string; code: string; category: string }) => void;
    saveEdit: () => void;
}

const BookstoreProductManagement = ({
    products,
    categories,
    newProductName,
    setNewProductName,
    newProductCode,
    setNewProductCode,
    newProductCategory,
    setNewProductCategory,
    newCategoryName,
    setNewCategoryName,
    handleAddProduct,
    handleDeleteProduct,
    handleAddCategory,
    handleDeleteCategory,
    handleToggleVisibility,
    startEditing,
    editingProduct,
    setEditingProduct,
    editForm,
    setEditForm,
    saveEdit,
}: BookstoreProductManagementProps) => (
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
                                <div className={`h-2 w-2 rounded-full ${product.isVisible ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`} />
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

export default BookstoreProductManagement;
