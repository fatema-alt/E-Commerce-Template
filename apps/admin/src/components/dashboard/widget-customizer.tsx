"use client";

import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useDashboard, DEFAULT_WIDGET_ORDER } from "./dashboard-context";

export const WIDGET_METADATA: Record<
  string,
  { label: string; description: string }
> = {
  "revenue-combo": {
    label: "Revenue Analytics",
    description: "Dual-axis revenue & orders combo chart",
  },
  "monthly-target": {
    label: "Monthly Target",
    description: "Radial progress ring & month pacing",
  },
  "conversion-funnel": {
    label: "Conversion Funnel",
    description: "Visitor to purchase funnel with drop-offs",
  },
  "top-categories": {
    label: "Top Categories",
    description: "Category breakdown & donut distribution",
  },
  "top-products": {
    label: "Top Selling Products",
    description: "Leaderboard of best-performing products",
  },
  "recent-orders": {
    label: "Recent Orders",
    description: "Live table of latest customer purchases",
  },
  "customer-activity": {
    label: "Customer Activity",
    description: "Active, new, returning, & repeat purchase rate",
  },
  "traffic-sources": {
    label: "Traffic Sources",
    description: "Acquisition breakdown by channel",
  },
  "lowStockAlerts": {
    label: "Low Stock Alerts",
    description: "Catalog items below reorder thresholds",
  },
  "low-stock-alerts": {
    label: "Low Stock Alerts",
    description: "Catalog items below reorder thresholds",
  },
  "payment-methods": {
    label: "Payment Methods",
    description: "bKash, Nagad, SSLCommerz, and COD shares",
  },
  "geo-districts": {
    label: "Orders by District",
    description: "Geographic distribution across Bangladesh",
  },
  "activity-feed": {
    label: "Store Activity Feed",
    description: "Chronological operational event stream",
  },
};

function SortableItem({
  id,
  hidden,
  onToggleHidden,
}: {
  id: string;
  hidden: boolean;
  onToggleHidden: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = WIDGET_METADATA[id] || {
    label: id,
    description: "Dashboard widget",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
        isDragging
          ? "border-indigo-500 bg-indigo-50/50 shadow-lg z-50 dark:bg-indigo-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#121A30] dark:hover:border-white/20"
      } ${hidden ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${meta.label}`}
          className="cursor-grab p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          <GripVertical size={16} />
        </button>
        <div className="truncate">
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {meta.label}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {meta.description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleHidden(id)}
        aria-label={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
          hidden
            ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
            : "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-400"
        }`}
      >
        {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        <span>{hidden ? "Hidden" : "Visible"}</span>
      </button>
    </div>
  );
}

function WidgetCustomizerModal({ onClose }: { onClose: () => void }) {
  const {
    widgetOrder,
    hiddenWidgets,
    saveLayout,
    resetLayout,
    dict,
  } = useDashboard();

  const [items, setItems] = useState<string[]>(
    widgetOrder.length > 0 ? widgetOrder : DEFAULT_WIDGET_ORDER,
  );
  const [hidden, setHidden] = useState<string[]>(hiddenWidgets);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function handleToggleHidden(id: string) {
    setHidden((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setSaving(true);
    await saveLayout(items, hidden);
    setSaving(false);
    onClose();
  }

  async function handleReset() {
    setSaving(true);
    await resetLayout();
    setItems(DEFAULT_WIDGET_ORDER);
    setHidden([]);
    setSaving(false);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customize Dashboard Layout"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-white/10 dark:bg-[#121A30]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {dict.customizeWidgets}
              </h3>
              <p className="text-[11px] text-slate-400">
                Drag to reorder widgets or toggle visibility.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sortable list */}
        <div className="my-4 max-h-96 overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              {items.map((id) => (
                <SortableItem
                  key={id}
                  id={id}
                  hidden={hidden.includes(id)}
                  onToggleHidden={handleToggleHidden}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 disabled:opacity-50"
          >
            <RotateCcw size={13} />
            <span>{dict.resetLayout}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
            >
              <Check size={14} />
              <span>{saving ? "Saving..." : "Save Layout"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WidgetCustomizer() {
  const { customizeModalOpen, setCustomizeModalOpen } = useDashboard();
  if (!customizeModalOpen) return null;
  return (
    <WidgetCustomizerModal onClose={() => setCustomizeModalOpen(false)} />
  );
}
