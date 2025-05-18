import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { BudgetCategory } from '@/types/budget';

interface BudgetTableProps {
  categories: BudgetCategory[];
  onEditCategory: (category: BudgetCategory) => void;
  onDeleteCategory: (category: BudgetCategory) => void;
  formatCurrency: (amount: number) => string;
  canEdit: boolean;
}

const BudgetTable: React.FC<BudgetTableProps> = ({
  categories,
  onEditCategory,
  onDeleteCategory,
  formatCurrency,
  canEdit
}) => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Detailed Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <Droppable droppableId="budget-categories">
          {(provided) => (
            <div 
              className="overflow-x-auto"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {canEdit && <th className="px-2 py-3 w-8"></th>}
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Estimated</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actual</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Remaining</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">% Used</th>
                    {canEdit && (
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => (
                    <Draggable 
                      key={category.id} 
                      draggableId={category.id} 
                      index={index}
                      isDragDisabled={!canEdit}
                    >
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`border-b last:border-0 text-foreground ${snapshot.isDragging ? 'bg-muted opacity-80' : 'hover:bg-muted/30'}`}
                        >
                          {canEdit && (
                            <td className="px-2 w-8">
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm font-medium">{category.name}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(category.estimated)}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(category.actual)}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(category.estimated - category.actual)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {category.estimated > 0 ? Math.round((category.actual / category.estimated) * 100) : 0}%
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3 text-sm text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onEditCategory(category)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteCategory(category)}
                                className="h-8 w-8 p-0 text-destructive"
                                aria-label="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </Button>
                            </td>
                          )}
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <tr className="font-medium bg-slate-50 dark:bg-slate-800 text-foreground">
                    {canEdit && <td></td>}
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(categories.reduce((sum, cat) => sum + cat.estimated, 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(categories.reduce((sum, cat) => sum + cat.actual, 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(
                      categories.reduce((sum, cat) => sum + cat.estimated - cat.actual, 0)
                    )}</td>
                    <td className="px-4 py-3 text-right">
                      {categories.reduce((sum, cat) => sum + cat.estimated, 0) > 0 ? 
                        Math.round((categories.reduce((sum, cat) => sum + cat.actual, 0) / 
                        categories.reduce((sum, cat) => sum + cat.estimated, 0)) * 100) : 0}%
                    </td>
                    {canEdit && <td className="px-4 py-3"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
};

export default BudgetTable;
