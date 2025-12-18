import { useState } from "react"
import { format, differenceInDays } from "date-fns"
import { AlertTriangle, Edit, ChevronLeft, ChevronRight, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { iconStyles } from "@/lib/icon-theme"
import type { Warning } from "@/services/dashboard.service"

interface DocumentWarningsTableProps {
  warnings: Warning[]
  isLoading: boolean
  onEditDocument: (warning: Warning) => void
  onViewHistory: (warning: Warning) => void
}

const ITEMS_PER_PAGE = 10

export function DocumentWarningsTable({ 
  warnings, 
  isLoading, 
  onEditDocument, 
  onViewHistory 
}: DocumentWarningsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(warnings.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentWarnings = warnings.slice(startIndex, endIndex)

  const getDaysRemaining = (expiryDate: Date) => {
    const today = new Date()
    const expiry = new Date(expiryDate)
    return differenceInDays(expiry, today)
  }

  const getDaysRemainingBadge = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return <Badge variant="danger">Đã hết hạn {Math.abs(daysRemaining)} ngày</Badge>
    } else if (daysRemaining === 0) {
      return <Badge variant="danger">Hết hạn hôm nay</Badge>
    } else if (daysRemaining <= 7) {
      return <Badge variant="danger">Còn {daysRemaining} ngày</Badge>
    } else if (daysRemaining <= 30) {
      return <Badge variant="warning">Còn {daysRemaining} ngày</Badge>
    } else {
      return <Badge variant="secondary">Còn {daysRemaining} ngày</Badge>
    }
  }

  const getRowClassName = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return "bg-red-50 border-red-200"
    } else if (daysRemaining <= 7) {
      return "bg-red-50 border-red-100"
    } else if (daysRemaining <= 30) {
      return "bg-yellow-50 border-yellow-100"
    }
    return ""
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={iconStyles.warningIcon} />
            Cảnh báo giấy tờ sắp hết hạn
          </CardTitle>
          <div className="text-sm text-gray-600">
            {warnings.length > 0 && `${warnings.length} cảnh báo`}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">Đang tải...</div>
        ) : warnings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Không có cảnh báo giấy tờ sắp hết hạn</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Thông tin</TableHead>
                    <TableHead>Giấy tờ</TableHead>
                    <TableHead>Ngày hết hạn</TableHead>
                    <TableHead>Còn lại</TableHead>
                    <TableHead className="text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentWarnings.map((warning, index) => {
                    const daysRemaining = getDaysRemaining(warning.expiryDate)
                    return (
                      <TableRow 
                        key={`${warning.type}-${warning.plateNumber || warning.name}-${index}`}
                        className={`hover:bg-gray-50 ${getRowClassName(daysRemaining)}`}
                      >
                        <TableCell>
                          <Badge variant={warning.type === "vehicle" ? "default" : "secondary"}>
                            {warning.type === "vehicle" ? "Xe" : "Lái xe"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {warning.type === "vehicle" 
                              ? warning.plateNumber 
                              : warning.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {warning.document}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(new Date(warning.expiryDate), "dd/MM/yyyy")}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getDaysRemainingBadge(daysRemaining)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditDocument(warning)}
                              className="h-8 w-8 p-0"
                              title="Chỉnh sửa giấy tờ"
                            >
                              <Edit className={iconStyles.editButton} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onViewHistory(warning)}
                              className="h-8 w-8 p-0"
                              title="Xem lịch sử"
                            >
                              <History className={iconStyles.historyButton} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Hiển thị {startIndex + 1}-{Math.min(endIndex, warnings.length)} của {warnings.length} cảnh báo
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="gap-1"
                  >
                    <ChevronLeft className={iconStyles.navigationIcon} />
                    Trước
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        size="sm"
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-1"
                  >
                    Sau
                    <ChevronRight className={iconStyles.navigationIcon} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}