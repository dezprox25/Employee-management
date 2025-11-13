import { useState, useEffect } from "react";
import { Clock, History, Download, BarChart3, Zap, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { ScrollArea } from "./components/ui/scroll-area";
import { TimeEntry } from "./components/TimeEntry";
import { EditEntryDialog } from "./components/EditEntryDialog";
import { ReportsDialog } from "./components/ReportsDialog";
import { SlideToCheckIn } from "./components/SlideToCheckIn";
import { SlideToCheckOut } from "./components/SlideToCheckOut";
import { WorkDurationCard } from "./components/WorkDurationCard";
import { WorkStation3DScene } from "./components/WorkStation3DScene";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { toast } from "sonner@2.0.3";
import jsPDF from "jspdf";
import { motion, AnimatePresence } from "motion/react";

interface TimeRecord {
  id: string;
  checkIn: string;
  checkOut?: string;
  date: string;
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [activeSession, setActiveSession] = useState<TimeRecord | null>(null);
  const [workDuration, setWorkDuration] = useState<string>("00:00:00");
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);

  // Load records from localStorage
  useEffect(() => {
    const savedRecords = localStorage.getItem("timeRecords");
    if (savedRecords) {
      const parsed = JSON.parse(savedRecords);
      setRecords(parsed);
      
      // Check for active session
      const active = parsed.find((r: TimeRecord) => !r.checkOut);
      if (active) {
        setActiveSession(active);
      }
    }
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate work duration for active session
  useEffect(() => {
    if (!activeSession) {
      setWorkDuration("00:00:00");
      return;
    }

    const interval = setInterval(() => {
      const checkInTime = new Date(activeSession.checkIn);
      const now = new Date();
      const diff = now.getTime() - checkInTime.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setWorkDuration(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleCheckIn = () => {
    const now = new Date();
    const newRecord: TimeRecord = {
      id: now.getTime().toString(),
      checkIn: now.toISOString(),
      date: now.toLocaleDateString("en-US", { 
        weekday: "short", 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      })
    };

    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    setActiveSession(newRecord);
    localStorage.setItem("timeRecords", JSON.stringify(updatedRecords));
    toast.success("Checked in successfully!");
  };

  const handleCheckOut = () => {
    if (!activeSession) return;

    const now = new Date();
    const updatedRecord = {
      ...activeSession,
      checkOut: now.toISOString()
    };

    const updatedRecords = records.map(r => 
      r.id === activeSession.id ? updatedRecord : r
    );

    setRecords(updatedRecords);
    setActiveSession(null);
    localStorage.setItem("timeRecords", JSON.stringify(updatedRecords));
    toast.success("Checked out successfully!");
  };

  const handleEditRecord = (record: TimeRecord) => {
    setEditingRecord(record);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (updatedRecord: TimeRecord) => {
    const updatedRecords = records.map(r => 
      r.id === updatedRecord.id ? updatedRecord : r
    );
    
    setRecords(updatedRecords);
    
    if (activeSession && activeSession.id === updatedRecord.id) {
      setActiveSession(updatedRecord);
    }
    
    localStorage.setItem("timeRecords", JSON.stringify(updatedRecords));
    toast.success("Entry updated successfully!");
  };

  const handleDeleteRecord = (record: TimeRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!recordToDelete) return;

    const updatedRecords = records.filter(r => r.id !== recordToDelete.id);
    setRecords(updatedRecords);
    
    if (activeSession && activeSession.id === recordToDelete.id) {
      setActiveSession(null);
    }
    
    localStorage.setItem("timeRecords", JSON.stringify(updatedRecords));
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
    toast.success("Entry deleted successfully!");
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      toast.error("No records to export!");
      return;
    }

    const headers = ["Date", "Check In", "Check Out", "Duration"];
    const rows = records.map(record => {
      const checkIn = new Date(record.checkIn).toLocaleString("en-US");
      const checkOut = record.checkOut ? new Date(record.checkOut).toLocaleString("en-US") : "N/A";
      const duration = record.checkOut ? calculateDuration(record.checkIn, record.checkOut) : "N/A";
      
      return [record.date, checkIn, checkOut, duration];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `time-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully!");
  };

  const exportToPDF = () => {
    if (records.length === 0) {
      toast.error("No records to export!");
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Time Tracker Report", 20, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    })}`, 20, 30);
    
    let yPosition = 45;
    doc.setFontSize(12);
    
    records.forEach((record, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      const checkIn = new Date(record.checkIn).toLocaleString("en-US");
      const checkOut = record.checkOut ? new Date(record.checkOut).toLocaleString("en-US") : "N/A";
      const duration = record.checkOut ? calculateDuration(record.checkIn, record.checkOut) : "In Progress";
      
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${record.date}`, 20, yPosition);
      doc.setFontSize(9);
      doc.text(`Check In: ${checkIn}`, 25, yPosition + 6);
      doc.text(`Check Out: ${checkOut}`, 25, yPosition + 12);
      doc.text(`Duration: ${duration}`, 25, yPosition + 18);
      
      yPosition += 28;
    });
    
    doc.save(`time-tracker-report-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF exported successfully!");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      second: "2-digit",
      hour12: true 
    });
  };

  const formatRecordTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const calculateDuration = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const getTodayStats = () => {
    const today = new Date().toDateString();
    const todayRecords = records.filter(r => new Date(r.checkIn).toDateString() === today && r.checkOut);
    const totalMs = todayRecords.reduce((acc, r) => {
      if (r.checkOut) {
        return acc + (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime());
      }
      return acc;
    }, 0);
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, sessions: todayRecords.length };
  };

  const stats = getTodayStats();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950 dark:to-indigo-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 relative z-10">
        {/* Header */}
        <motion.div 
          className="text-center pt-8 pb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 mb-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="p-2 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg">
              <Zap className="size-6 text-white" />
            </div>
          </motion.div>
          <h1 className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Time Tracker Pro
          </h1>
          <p className="text-muted-foreground">Track your productivity effortlessly</p>
        </motion.div>

        {/* Quick Stats Bar */}
        <motion.div 
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border border-white/20 dark:border-gray-700/30 rounded-2xl p-3 shadow-lg"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="text-xs text-muted-foreground mb-1">Today</div>
            <div className="text-lg tabular-nums">{stats.hours}h {stats.minutes}m</div>
          </motion.div>
          <motion.div 
            className="backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border border-white/20 dark:border-gray-700/30 rounded-2xl p-3 shadow-lg"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="text-xs text-muted-foreground mb-1">Sessions</div>
            <div className="text-lg tabular-nums">{stats.sessions}</div>
          </motion.div>
          <motion.div 
            className="backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border border-white/20 dark:border-gray-700/30 rounded-2xl p-3 shadow-lg"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="text-xs text-muted-foreground mb-1">Total</div>
            <div className="text-lg tabular-nums">{records.length}</div>
          </motion.div>
        </motion.div>

        {/* Current Time Card */}
        <motion.div
          className="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 dark:border-gray-700/30 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl" />
          <motion.div 
            className="flex items-center justify-center gap-2 text-muted-foreground mb-4"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Clock className="size-5" />
            <span>Current Time</span>
          </motion.div>
          <motion.div 
            className="text-5xl tabular-nums bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2"
            key={formatTime(currentTime)}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {formatTime(currentTime)}
          </motion.div>
          <div className="text-sm text-muted-foreground">
            {currentTime.toLocaleDateString("en-US", { 
              weekday: "long", 
              month: "short", 
              day: "numeric" 
            })}
          </div>
        </motion.div>

        {/* Active Session */}
        <AnimatePresence mode="wait">
          {activeSession ? (
            <WorkDurationCard
              duration={workDuration}
              checkInTime={formatRecordTime(activeSession.checkIn)}
            />
          ) : null}
        </AnimatePresence>

        {/* Action Buttons - Slide Components */}
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {!activeSession ? (
            <SlideToCheckIn onComplete={handleCheckIn} />
          ) : (
            <SlideToCheckOut onComplete={handleCheckOut} />
          )}
        </motion.div>

        {/* Reports and Export Buttons */}
        <motion.div 
          className="grid grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => setReportsDialogOpen(true)}
              className="w-full h-14 backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border-white/20 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-900/80 rounded-2xl shadow-lg"
            >
              <BarChart3 className="size-5 mr-2" />
              Reports
            </Button>
          </motion.div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline" 
                  className="w-full h-14 backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border-white/20 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-900/80 rounded-2xl shadow-lg"
                >
                  <Download className="size-5 mr-2" />
                  Export
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border-white/20 dark:border-gray-700/30">
              <DropdownMenuItem onClick={exportToCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>

        {/* History */}
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <History className="size-5" />
            <h2>Recent Activity</h2>
          </div>

          {records.length === 0 ? (
            <motion.div
              className="backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 border border-white/20 dark:border-gray-700/30 rounded-2xl p-12 text-center shadow-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-muted-foreground">
                No time records yet. Check in to start tracking!
              </div>
            </motion.div>
          ) : (
            <ScrollArea className="h-[400px] rounded-2xl">
              <div className="space-y-3 pr-4">
                <AnimatePresence mode="popLayout">
                  {records.map((record, index) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      layout
                    >
                      <TimeEntry
                        checkIn={formatRecordTime(record.checkIn)}
                        checkOut={record.checkOut ? formatRecordTime(record.checkOut) : undefined}
                        date={record.date}
                        duration={
                          record.checkOut 
                            ? calculateDuration(record.checkIn, record.checkOut)
                            : undefined
                        }
                        onEdit={() => handleEditRecord(record)}
                        onDelete={() => handleDeleteRecord(record)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </motion.div>
      </div>

      {/* 3D Animated Workstation Scene */}
      <WorkStation3DScene isCheckedIn={!!activeSession} />

      {/* Edit Dialog */}
      <EditEntryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={editingRecord}
        onSave={handleSaveEdit}
      />

      {/* Reports Dialog */}
      <ReportsDialog
        open={reportsDialogOpen}
        onOpenChange={setReportsDialogOpen}
        records={records}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border-white/20 dark:border-gray-700/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}