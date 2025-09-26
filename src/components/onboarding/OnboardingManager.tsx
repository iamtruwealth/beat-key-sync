import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStep {
  id: string;
  guide_id: string;
  step_number: number;
  title: string;
  content: string;
  route: string;
  is_active: boolean;
}

interface OnboardingGuide {
  id: string;
  role: string;
  title: string;
  description: string;
  is_active: boolean;
}

export function OnboardingManager() {
  const [guides, setGuides] = useState<OnboardingGuide[]>([]);
  const [steps, setSteps] = useState<{ [key: string]: OnboardingStep[] }>({});
  const [editingGuide, setEditingGuide] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [newStep, setNewStep] = useState<{ guide_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadOnboardingData();
  }, []);

  const loadOnboardingData = async () => {
    try {
      const { data: guidesData, error: guidesError } = await supabase
        .from('onboarding_guides')
        .select('*')
        .order('role');

      if (guidesError) throw guidesError;
      setGuides(guidesData || []);

      // Load steps for each guide
      const stepsData: { [key: string]: OnboardingStep[] } = {};
      for (const guide of guidesData || []) {
        const { data: guideSteps, error: stepsError } = await supabase
          .from('onboarding_steps')
          .select('*')
          .eq('guide_id', guide.id)
          .order('step_number');

        if (stepsError) throw stepsError;
        stepsData[guide.id] = guideSteps || [];
      }
      setSteps(stepsData);
    } catch (error) {
      console.error('Error loading onboarding data:', error);
      toast({
        title: "Error",
        description: "Failed to load onboarding data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateGuide = async (guide: OnboardingGuide) => {
    try {
      const { error } = await supabase
        .from('onboarding_guides')
        .update({
          title: guide.title,
          description: guide.description,
          is_active: guide.is_active
        })
        .eq('id', guide.id);

      if (error) throw error;

      setGuides(guides.map(g => g.id === guide.id ? guide : g));
      setEditingGuide(null);
      toast({
        title: "Success",
        description: "Guide updated successfully"
      });
    } catch (error) {
      console.error('Error updating guide:', error);
      toast({
        title: "Error",
        description: "Failed to update guide",
        variant: "destructive"
      });
    }
  };

  const updateStep = async (step: OnboardingStep) => {
    try {
      const { error } = await supabase
        .from('onboarding_steps')
        .update({
          title: step.title,
          content: step.content,
          route: step.route,
          step_number: step.step_number,
          is_active: step.is_active
        })
        .eq('id', step.id);

      if (error) throw error;

      setSteps({
        ...steps,
        [step.guide_id]: steps[step.guide_id].map(s => s.id === step.id ? step : s)
      });
      setEditingStep(null);
      toast({
        title: "Success",
        description: "Step updated successfully"
      });
    } catch (error) {
      console.error('Error updating step:', error);
      toast({
        title: "Error",
        description: "Failed to update step",
        variant: "destructive"
      });
    }
  };

  const createStep = async (guideId: string, stepData: Partial<OnboardingStep>) => {
    try {
      const maxStepNumber = Math.max(0, ...(steps[guideId] || []).map(s => s.step_number));
      
      const { data, error } = await supabase
        .from('onboarding_steps')
        .insert({
          guide_id: guideId,
          step_number: maxStepNumber + 1,
          title: stepData.title || '',
          content: stepData.content || '',
          route: stepData.route || '/'
        })
        .select()
        .single();

      if (error) throw error;

      setSteps({
        ...steps,
        [guideId]: [...(steps[guideId] || []), data]
      });
      setNewStep(null);
      toast({
        title: "Success",
        description: "Step created successfully"
      });
    } catch (error) {
      console.error('Error creating step:', error);
      toast({
        title: "Error",
        description: "Failed to create step",
        variant: "destructive"
      });
    }
  };

  const deleteStep = async (step: OnboardingStep) => {
    try {
      const { error } = await supabase
        .from('onboarding_steps')
        .delete()
        .eq('id', step.id);

      if (error) throw error;

      setSteps({
        ...steps,
        [step.guide_id]: steps[step.guide_id].filter(s => s.id !== step.id)
      });
      toast({
        title: "Success",
        description: "Step deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting step:', error);
      toast({
        title: "Error",
        description: "Failed to delete step",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading onboarding manager...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Onboarding Management</h2>
        <p className="text-muted-foreground">
          Manage onboarding guides and steps for different user roles.
        </p>
      </div>

      {guides.map(guide => (
        <Card key={guide.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="capitalize">{guide.role} Guide</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingGuide(editingGuide === guide.id ? null : guide.id)}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingGuide === guide.id && (
              <div className="p-4 border rounded-lg space-y-4">
                <div>
                  <Label htmlFor={`title-${guide.id}`}>Title</Label>
                  <Input
                    id={`title-${guide.id}`}
                    value={guide.title}
                    onChange={(e) => setGuides(guides.map(g => 
                      g.id === guide.id ? { ...g, title: e.target.value } : g
                    ))}
                  />
                </div>
                <div>
                  <Label htmlFor={`description-${guide.id}`}>Description</Label>
                  <Textarea
                    id={`description-${guide.id}`}
                    value={guide.description || ''}
                    onChange={(e) => setGuides(guides.map(g => 
                      g.id === guide.id ? { ...g, description: e.target.value } : g
                    ))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateGuide(guide)}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingGuide(null)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Steps</h4>
                <Button
                  size="sm"
                  onClick={() => setNewStep({ guide_id: guide.id })}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-3">
                {(steps[guide.id] || []).map(step => (
                  <div key={step.id} className="border rounded-lg p-4">
                    {editingStep === step.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={step.title}
                            onChange={(e) => setSteps({
                              ...steps,
                              [guide.id]: steps[guide.id].map(s => 
                                s.id === step.id ? { ...s, title: e.target.value } : s
                              )
                            })}
                          />
                        </div>
                        <div>
                          <Label>Content</Label>
                          <Textarea
                            value={step.content}
                            onChange={(e) => setSteps({
                              ...steps,
                              [guide.id]: steps[guide.id].map(s => 
                                s.id === step.id ? { ...s, content: e.target.value } : s
                              )
                            })}
                          />
                        </div>
                        <div>
                          <Label>Route</Label>
                          <Input
                            value={step.route}
                            onChange={(e) => setSteps({
                              ...steps,
                              [guide.id]: steps[guide.id].map(s => 
                                s.id === step.id ? { ...s, route: e.target.value } : s
                              )
                            })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateStep(step)}>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingStep(null)}>
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-medium">Step {step.step_number}: {step.title}</h5>
                          <p className="text-sm text-muted-foreground">{step.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">Route: {step.route}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingStep(step.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteStep(step)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {newStep?.guide_id === guide.id && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        placeholder="Step title"
                        id="new-step-title"
                      />
                    </div>
                    <div>
                      <Label>Content</Label>
                      <Textarea
                        placeholder="Step content"
                        id="new-step-content"
                      />
                    </div>
                    <div>
                      <Label>Route</Label>
                      <Input
                        placeholder="/route"
                        id="new-step-route"
                        defaultValue="/"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          const title = (document.getElementById('new-step-title') as HTMLInputElement)?.value || '';
                          const content = (document.getElementById('new-step-content') as HTMLTextAreaElement)?.value || '';
                          const route = (document.getElementById('new-step-route') as HTMLInputElement)?.value || '/';
                          createStep(guide.id, { title, content, route });
                        }}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Create
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setNewStep(null)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}