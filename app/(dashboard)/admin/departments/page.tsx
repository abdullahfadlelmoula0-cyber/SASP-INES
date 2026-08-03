"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Trash2, Edit, BookOpen, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [yearNumber, setYearNumber] = useState("4");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    setLoading(true);
    // تم إزالة .order("created_at") لعدم وجود العمود في الجدول
    const { data } = await (supabase.from("departments") as any).select("*");
    if (data) setDepartments(data);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    const departmentData = {
      name,
      code,
      description,
      year_number: parseInt(yearNumber) || 4
    };

    if (editingId) {
      const { error } = await (supabase.from("departments") as any).update(departmentData).eq("id", editingId);
      if (error) console.error("Error updating:", error.message);
      else setEditingId(null);
    } else {
      const { error } = await (supabase.from("departments") as any).insert([departmentData]);
      if (error) console.error("Error inserting:", error.message);
    }

    setName("");
    setCode("");
    setDescription("");
    setYearNumber("4");
    fetchDepartments();
  }

  function handleEdit(dept: any) {
    setEditingId(dept.id);
    setName(dept.name);
    setCode(dept.code || "");
    setDescription(dept.description || "");
    setYearNumber(dept.year_number?.toString() || "4");
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this department?")) {
      await (supabase.from("departments") as any).delete().eq("id", id);
      fetchDepartments();
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-6">
      <PageHeader
        title="Departments Management"
        description="Configure department details and study years for the institution"
      />

      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Edit Department" : "Add New Department"}</CardTitle>
          <CardDescription>Configure department details and study years for the institution</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Department Name (e.g., Computer Science)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              placeholder="Code (e.g., CS)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Total Years (e.g., 3, 4)"
              value={yearNumber}
              onChange={(e) => setYearNumber(e.target.value)}
              required
            />
            <Input
              placeholder="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="md:col-span-2 lg:col-span-4 flex gap-2 pt-2">
              <Button type="submit" className="gap-2">
                <Plus className="w-4 h-4" /> {editingId ? "Update Department" : "Add Department"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setName(""); setCode(""); setDescription(""); setYearNumber("4"); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <Card key={dept.id} className="border-border/60 shadow-sm flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(dept)}>
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(dept.id)}>
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg mt-3">{dept.name}</CardTitle>
              <CardDescription>{dept.description || "No description provided."}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono bg-muted px-2 py-1 rounded">Code: {dept.code || "N/A"}</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> {dept.year_number || 4} Years Program
                </span>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-border/40">
                <Link href={`/admin/departments/${dept.id}`}>
                  <Button size="sm" variant="outline" className="gap-1 text-xs">
                    <BookOpen className="w-3.5 h-3.5" /> Manage Courses <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {departments.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-10">No departments found. Create your first one above.</p>
        )}
      </div>
    </div>
  );
}