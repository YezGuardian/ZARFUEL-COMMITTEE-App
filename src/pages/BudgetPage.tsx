import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import BudgetHeader from '@/components/budget/BudgetHeader';
import BudgetSummary from '@/components/budget/BudgetSummary';
import BudgetCharts from '@/components/budget/BudgetCharts';
import BudgetTable from '@/components/budget/BudgetTable';
import BudgetCategoryDialog from '@/components/budget/BudgetCategoryDialog';
import { useBudget } from '@/hooks/useBudget';
import { BudgetCategory } from '@/types/budget';
import { createBudgetNotification } from '@/utils/notificationService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { DropResult } from '@hello-pangea/dnd';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const BudgetPage: React.FC = () => {
  const [viewType, setViewType] = useState('estimated');
  const { isSpecial, isSuperAdmin, user } = useAuth();
  const canEdit = isSpecial() || isSuperAdmin();
  
  // State for real budget categories
  const [categories, setCategories] = useState<Database['public']['Tables']['budget_categories']['Row'][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Database['public']['Tables']['budget_categories']['Row'] | null>(null);
  const [addCategoryDialog, setAddCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState<Database['public']['Tables']['budget_categories']['Row']>({
    id: '',
    name: '',
    estimated: 0,
    actual: 0
  });

  // Fetch categories from Supabase
  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('budget_categories')
      .select('*')
      .order('name');
    if (error) {
      toast.error('Failed to load budget categories');
      setIsLoading(false);
      return;
    }
    setCategories(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSaveCategoryWithNotification = async () => {
    if (!editCategory) return;
    const { data, error } = await supabase
      .from('budget_categories')
      .update({
        name: editCategory.name,
        estimated: editCategory.estimated,
        actual: editCategory.actual
      })
      .eq('id', editCategory.id)
      .select()
      .single<Database['public']['Tables']['budget_categories']['Row']>();
    if (error) {
      toast.error('Failed to update budget category');
      return;
    }
    await createBudgetNotification({
      budgetId: editCategory.id,
      budgetTitle: editCategory.name,
      action: 'updated',
      performedBy: user?.email || 'A user',
      excludeUserId: user?.id
    });
    setEditDialogOpen(false);
    toast.success(`Updated ${editCategory.name} budget`);
    fetchCategories();
  };

  const handleAddCategoryWithNotification = async () => {
    if (!newCategory.name.trim()) return;
    const { data, error } = await supabase
      .from('budget_categories')
      .insert({
        name: newCategory.name,
        estimated: newCategory.estimated,
        actual: newCategory.actual
      })
      .select()
      .single<Database['public']['Tables']['budget_categories']['Row']>();
    if (error) {
      toast.error('Failed to add budget category');
      return;
    }
    await createBudgetNotification({
      budgetId: data.id,
      budgetTitle: data.name,
      action: 'created',
      performedBy: user?.email || 'A user',
      excludeUserId: user?.id
    });
    setAddCategoryDialog(false);
    setNewCategory({ id: '', name: '', estimated: 0, actual: 0 });
    toast.success(`Added new budget category: ${data.name}`);
    fetchCategories();
  };

  // Calculate totals and percentages from categories
  const totalBudget = categories.reduce((sum, cat) => sum + cat.estimated, 0);
  const totalActual = categories.reduce((sum, cat) => sum + cat.actual, 0);
  // Calculate allocated as the sum of categories with actual spending > 0
  const allocated = categories
    .filter(cat => cat.actual > 0)
    .reduce((sum, cat) => sum + cat.estimated, 0);
  const spent = totalActual;
  const remainingBudget = totalBudget - totalActual;
  const allocatedPercentage = totalBudget > 0 ? Math.round((allocated / totalBudget) * 100) : 0;
  const spentPercentage = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const handleEditCategory = (category: Database['public']['Tables']['budget_categories']['Row']) => {
    setEditCategory(category);
    setEditDialogOpen(true);
  };

  const handleDragEnd = (result: DropResult) => {
    // Handle drag and drop logic (optional: implement reordering in the database if needed)
  };

  // Bar chart data based on viewType
  const getBarChartData = () => {
    return categories.map(cat => ({
      name: cat.name,
      Estimated: cat.estimated,
      Actual: cat.actual
    }));
  };

  // Pie chart data based on viewType
  const getPieChartData = (viewType: string) => {
    const total = viewType === 'estimated' ? totalBudget : totalActual;
    return categories.map(cat => ({
      name: cat.name,
      value: viewType === 'estimated' ? cat.estimated : cat.actual,
      percent: total > 0 ? Math.round(((viewType === 'estimated' ? cat.estimated : cat.actual) / total) * 100) : 0
    }));
  };

  // Delete a budget category with logging and notification
  const handleDeleteCategoryWithLogging = async (category: Database['public']['Tables']['budget_categories']['Row']) => {
    const { error } = await supabase
      .from('budget_categories')
      .delete()
      .eq('id', category.id);
    if (error) {
      toast.error('Failed to delete budget category');
      return;
    }
    // Log deletion
    await supabase.from('deletion_logs').insert({
      table_name: 'budget_categories',
      record_id: category.id,
      deleted_by: user?.id || '',
      deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
      details: category,
    });
    // Send notification
    await createBudgetNotification({
      budgetId: category.id,
      budgetTitle: category.name,
      action: 'deleted',
      performedBy: user?.user_metadata?.full_name || user?.email || '',
      excludeUserId: user?.id
    });
    toast.success(`Deleted budget category: ${category.name}`);
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <BudgetHeader 
        canEdit={canEdit} 
        onAddCategory={() => setAddCategoryDialog(true)}
      />
      
      <BudgetSummary 
        totalBudget={totalBudget}
        allocated={allocated}
        spent={spent}
        remainingBudget={remainingBudget}
        allocatedPercentage={allocatedPercentage}
        spentPercentage={spentPercentage}
        formatCurrency={formatCurrency}
      />
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <BudgetCharts 
          viewType={viewType} 
          setViewType={setViewType} 
          barChartData={getBarChartData()}
          pieChartData={getPieChartData(viewType)}
          COLORS={COLORS}
          formatCurrency={formatCurrency}
        />
        
        <BudgetTable 
          categories={categories}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategoryWithLogging}
          formatCurrency={formatCurrency}
          canEdit={canEdit}
        />
      </DragDropContext>
      
      <BudgetCategoryDialog 
        isEdit={!!editCategory}
        category={editCategory}
        setCategory={setEditCategory}
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveCategoryWithNotification}
        newCategory={newCategory}
        setNewCategory={setNewCategory}
        isAddOpen={addCategoryDialog}
        onAddOpenChange={setAddCategoryDialog}
        onAdd={handleAddCategoryWithNotification}
      />
    </div>
  );
};

export default BudgetPage;
