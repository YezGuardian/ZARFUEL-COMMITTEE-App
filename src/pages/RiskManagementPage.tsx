
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { riskData } from '@/data/mockData';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Risk {
  id: string;
  name: string;
  category: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  status: 'identified' | 'mitigated' | 'ongoing';
  description: string;
  mitigation_strategy: string;
  responsible_person: string;
}

const RiskManagementPage: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>(riskData);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [addRiskDialogOpen, setAddRiskDialogOpen] = useState(false);
  const [editRiskDialogOpen, setEditRiskDialogOpen] = useState(false);
  const [deleteRiskDialogOpen, setDeleteRiskDialogOpen] = useState(false);
  const [newRisk, setNewRisk] = useState<Omit<Risk, 'id'>>({
    name: '',
    category: '',
    impact: 'medium',
    likelihood: 'medium',
    status: 'identified',
    description: '',
    mitigation_strategy: '',
    responsible_person: ''
  });
  
  const { isAdmin } = useAuth();
  
  // Calculate the percentage of mitigated risks
  const mitigatedRisks = risks.filter(risk => risk.status === 'mitigated');
  const mitigatedPercentage = Math.round((mitigatedRisks.length / risks.length) * 100) || 0;
  
  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'low':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Low</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
      case 'high':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 hover:bg-orange-100">High</Badge>;
      case 'critical':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  const getLikelihoodBadge = (likelihood: string) => {
    switch (likelihood) {
      case 'low':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Low</Badge>;
      case 'medium':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-100">Medium</Badge>;
      case 'high':
        return <Badge variant="outline" className="bg-pink-100 text-pink-800 hover:bg-pink-100">High</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'identified':
        return <Badge className="bg-slate-500">Identified</Badge>;
      case 'mitigated':
        return <Badge className="bg-green-500">Mitigated</Badge>;
      case 'ongoing':
        return <Badge className="bg-yellow-500">Ongoing</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };
  
  const handleAddRisk = () => {
    if (!newRisk.name) return;
    
    const risk: Risk = {
      id: Math.random().toString(36).substring(2, 9),
      ...newRisk
    };
    
    setRisks([...risks, risk]);
    setAddRiskDialogOpen(false);
    setNewRisk({
      name: '',
      category: '',
      impact: 'medium',
      likelihood: 'medium',
      status: 'identified',
      description: '',
      mitigation_strategy: '',
      responsible_person: ''
    });
    toast.success('Risk added successfully');
  };
  
  const handleEditRisk = () => {
    if (!editingRisk) return;
    
    setRisks(risks.map(risk => risk.id === editingRisk.id ? editingRisk : risk));
    setEditRiskDialogOpen(false);
    setEditingRisk(null);
    toast.success('Risk updated successfully');
  };
  
  const handleDeleteRisk = () => {
    if (!editingRisk) return;
    
    setRisks(risks.filter(risk => risk.id !== editingRisk.id));
    setDeleteRiskDialogOpen(false);
    setEditingRisk(null);
    toast.success('Risk deleted successfully');
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Management</h1>
          <p className="text-muted-foreground">
            Identify, assess, and mitigate project risks
          </p>
        </div>
        
        {isAdmin() && (
          <Button 
            className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
            onClick={() => setAddRiskDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Risk
          </Button>
        )}
      </div>
      
      {/* Risk Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Risk Mitigation Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="text-sm font-medium mr-4">{mitigatedPercentage}% Mitigated</div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="h-2.5 rounded-full bg-green-500" 
                  style={{ width: `${mitigatedPercentage}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Risks</p>
                <p className="text-2xl font-bold">{risks.length}</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground mb-1">Mitigated</p>
                <p className="text-2xl font-bold text-green-600">{mitigatedRisks.length}</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-yellow-600">{risks.length - mitigatedRisks.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Risk Register */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Risk Register</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Likelihood</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsible</TableHead>
                  {isAdmin() && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map(risk => (
                  <TableRow key={risk.id}>
                    <TableCell className="font-medium">{risk.name}</TableCell>
                    <TableCell>{risk.category}</TableCell>
                    <TableCell>{getImpactBadge(risk.impact)}</TableCell>
                    <TableCell>{getLikelihoodBadge(risk.likelihood)}</TableCell>
                    <TableCell>{getStatusBadge(risk.status)}</TableCell>
                    <TableCell>{risk.responsible_person}</TableCell>
                    {isAdmin() && (
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingRisk(risk);
                              setEditRiskDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive" 
                            onClick={() => {
                              setEditingRisk(risk);
                              setDeleteRiskDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Risk Dialog */}
      <Dialog open={addRiskDialogOpen} onOpenChange={setAddRiskDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add New Risk</DialogTitle>
            <DialogDescription>
              Add a new risk to the risk register
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-140px)] p-1">
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-name">Risk Name</Label>
                  <Input
                    id="risk-name"
                    placeholder="Enter risk name"
                    value={newRisk.name}
                    onChange={(e) => setNewRisk({ ...newRisk, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="risk-category">Category</Label>
                  <Input
                    id="risk-category"
                    placeholder="e.g., Technical, Financial, Operational"
                    value={newRisk.category}
                    onChange={(e) => setNewRisk({ ...newRisk, category: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="risk-impact">Impact</Label>
                    <Select
                      value={newRisk.impact}
                      onValueChange={(value) => setNewRisk({ ...newRisk, impact: value as any })}
                    >
                      <SelectTrigger id="risk-impact">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="risk-likelihood">Likelihood</Label>
                    <Select
                      value={newRisk.likelihood}
                      onValueChange={(value) => setNewRisk({ ...newRisk, likelihood: value as any })}
                    >
                      <SelectTrigger id="risk-likelihood">
                        <SelectValue placeholder="Select likelihood" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="risk-status">Status</Label>
                    <Select
                      value={newRisk.status}
                      onValueChange={(value) => setNewRisk({ ...newRisk, status: value as any })}
                    >
                      <SelectTrigger id="risk-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identified">Identified</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                        <SelectItem value="mitigated">Mitigated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="risk-responsible">Responsible Person</Label>
                    <Input
                      id="risk-responsible"
                      placeholder="Who will handle this risk?"
                      value={newRisk.responsible_person}
                      onChange={(e) => setNewRisk({ ...newRisk, responsible_person: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="risk-description">Description</Label>
                  <Textarea
                    id="risk-description"
                    placeholder="Describe the risk in detail"
                    value={newRisk.description}
                    onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="risk-mitigation">Mitigation Strategy</Label>
                  <Textarea
                    id="risk-mitigation"
                    placeholder="How will this risk be mitigated?"
                    value={newRisk.mitigation_strategy}
                    onChange={(e) => setNewRisk({ ...newRisk, mitigation_strategy: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRiskDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddRisk} 
              disabled={!newRisk.name}
            >
              Add Risk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Risk Dialog */}
      {editingRisk && (
        <Dialog open={editRiskDialogOpen} onOpenChange={setEditRiskDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Edit Risk</DialogTitle>
              <DialogDescription>
                Update risk information
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(85vh-140px)] p-1">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-risk-name">Risk Name</Label>
                    <Input
                      id="edit-risk-name"
                      placeholder="Enter risk name"
                      value={editingRisk.name}
                      onChange={(e) => setEditingRisk({ ...editingRisk, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-risk-category">Category</Label>
                    <Input
                      id="edit-risk-category"
                      placeholder="e.g., Technical, Financial, Operational"
                      value={editingRisk.category}
                      onChange={(e) => setEditingRisk({ ...editingRisk, category: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-risk-impact">Impact</Label>
                      <Select
                        value={editingRisk.impact}
                        onValueChange={(value) => setEditingRisk({ ...editingRisk, impact: value as any })}
                      >
                        <SelectTrigger id="edit-risk-impact">
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-risk-likelihood">Likelihood</Label>
                      <Select
                        value={editingRisk.likelihood}
                        onValueChange={(value) => setEditingRisk({ ...editingRisk, likelihood: value as any })}
                      >
                        <SelectTrigger id="edit-risk-likelihood">
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-risk-status">Status</Label>
                      <Select
                        value={editingRisk.status}
                        onValueChange={(value) => setEditingRisk({ ...editingRisk, status: value as any })}
                      >
                        <SelectTrigger id="edit-risk-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="identified">Identified</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="mitigated">Mitigated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-risk-responsible">Responsible Person</Label>
                      <Input
                        id="edit-risk-responsible"
                        placeholder="Who will handle this risk?"
                        value={editingRisk.responsible_person}
                        onChange={(e) => setEditingRisk({ ...editingRisk, responsible_person: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-risk-description">Description</Label>
                    <Textarea
                      id="edit-risk-description"
                      placeholder="Describe the risk in detail"
                      value={editingRisk.description}
                      onChange={(e) => setEditingRisk({ ...editingRisk, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-risk-mitigation">Mitigation Strategy</Label>
                    <Textarea
                      id="edit-risk-mitigation"
                      placeholder="How will this risk be mitigated?"
                      value={editingRisk.mitigation_strategy}
                      onChange={(e) => setEditingRisk({ ...editingRisk, mitigation_strategy: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRiskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditRisk}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Delete Risk Dialog */}
      {editingRisk && (
        <Dialog open={deleteRiskDialogOpen} onOpenChange={setDeleteRiskDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Risk</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this risk? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="font-medium">{editingRisk.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{editingRisk.category}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRiskDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteRisk}>
                Delete Risk
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default RiskManagementPage;
