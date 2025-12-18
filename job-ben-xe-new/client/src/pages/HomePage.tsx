import { Link } from "react-router-dom"
import { CheckCircle, Building2, FileText, CreditCard, Key, Bus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import backgroundImage from "@/assets/ben-xe.webp"

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Banner Doanh Nghiệp - Chuyển đổi số */}
      <section className="relative bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 py-16 lg:py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <div className="mb-6">
                <h1 className="text-4xl lg:text-5xl font-bold mb-4">
                  <span className="text-primary">Chuyển đổi số</span>
                  <br />
                  <span className="text-red-600">GIẢI PHÁP TOÀN DIỆN</span>
                  <br />
                  <span className="text-primary">CHO BẾN XE VÀ DOANH NGHIỆP VẬN TẢI</span>
                </h1>
              </div>
              
              <div className="space-y-4 mb-8 text-black ">
                <p className="text-lg leading-relaxed font-bold">
                  Công ty ABC tập trung 
                  vào việc nâng cao chất lượng dịch vụ và tiện ích cho hành khách thông qua các giải pháp 
                  công nghệ hiện đại như quản lý thông tin, bán vé trực tuyến và hệ thống thanh toán điện tử.
                </p>
                <p className="text-lg leading-relaxed">
                  Chúng tôi cam kết áp dụng công nghệ tiên tiến dựa trên triết lý lấy khách hàng làm trung tâm, 
                  mang lại những giải pháp tối ưu cho ngành vận tải hành khách.
                </p>
              </div>

              <Link to="/products">
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg rounded-2xl">
                  TÌM HIỂU THÊM!
                </Button>
              </Link>

              {/* Solution Icons */}
              <div className="mt-12 grid grid-cols-5 gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
                    <FileText className="h-8 w-8 text-blue-700" />
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium">Phần mềm QLBX</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
                    <CreditCard className="h-8 w-8 text-blue-700" />
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium">Thanh toán tự động</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
                    <Key className="h-8 w-8 text-blue-700" />
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium">Cổng vào ra tự động</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle className="h-8 w-8 text-blue-700" />
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium">Bán vé ủy thác</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mb-2">
                    <Building2 className="h-8 w-8 text-blue-700" />
                  </div>
                  <p className="text-xs text-center text-gray-700 font-medium">Máy tính tiền HĐĐT</p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block relative">
              <div className="relative z-10">
                <img
                  src={backgroundImage}
                  alt="Bến xe"
                  className="rounded-lg shadow-2xl w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thông tin khái quát giới thiệu về doanh nghiệp */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                ABC C&T
              </h2>
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <p className="text-lg">
                  Công ty cổ phần tư vấn và chuyển giao công nghệ ABC (ABC C&T) bắt đầu hành trình 
                  với sự thấu hiểu các khó khăn, nhu cầu của lĩnh vực bến xe khách và vận tải hành khách tuyến cố định.
                </p>
                <p className="text-lg">
                  Trong bối cảnh nhu cầu vận tải hành khách tuyến cố định ngày càng tăng, ABC C&T đã bắt tay 
                  vào hành trình này với sự thấu hiểu sâu sắc các khó khăn và nhu cầu của thị trường. Bằng cách đặt 
                  khách hàng làm trung tâm và tìm hiểu các yêu cầu của họ, ABC C&T đã đưa ra những giải pháp 
                  tối ưu để cải thiện trải nghiệm của hành khách.
                </p>
                <p className="text-xl font-semibold text-primary">
                  Bắt đầu từ khách hàng – tìm hiểu và mang lại điều họ muốn!
                </p>
              </div>
              <Link to="/products" className="inline-block mt-6">
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white">
                  Tìm hiểu thêm
                </Button>
              </Link>
            </div>
            <div className="hidden lg:block">
              <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 rounded-lg p-8 h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center text-white">
                  <Bus className="h-32 w-32 mx-auto mb-4 opacity-80" />
                  <p className="text-lg">Giải pháp công nghệ thông minh</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thông tin về các con số thể hiện uy tín */}
      <section className="py-20 bg-teal-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div className="text-center">
              <div className="text-5xl lg:text-6xl font-bold mb-4">600+</div>
              <p className="text-lg lg:text-xl">Doanh nghiệp vận tải đã sử dụng</p>
            </div>
            <div className="text-center">
              <div className="text-5xl lg:text-6xl font-bold mb-4">500+</div>
              <p className="text-lg lg:text-xl">Bến xe nhận & ký lệnh điện tử</p>
            </div>
            <div className="text-center">
              <div className="text-5xl lg:text-6xl font-bold mb-4">10.000+</div>
              <p className="text-lg lg:text-xl">Xe khách kết nối trong hệ thống</p>
            </div>
            <div className="text-center">
              <div className="text-5xl lg:text-6xl font-bold mb-4">9.000+</div>
              <p className="text-lg lg:text-xl">Lệnh điện tử phát hành mỗi ngày</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng giá các sản phẩm đặc trưng */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Bảng giá sản phẩm
            </h2>
            <p className="text-lg text-gray-600">
              Các giải pháp công nghệ hàng đầu cho bến xe và doanh nghiệp vận tải
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Sản phẩm 1: Lệnh vận chuyển điện tử */}
            <Card className="border-2 border-blue-200 hover:border-primary transition-all shadow-lg">
              <CardHeader className="bg-blue-50 pb-4">
                <h3 className="text-xl font-bold text-gray-900">Lệnh vận chuyển điện tử</h3>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="text-4xl font-bold text-purple-700 mb-2">500.000₫</div>
                  <p className="text-gray-600">/ tháng</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Ký số lệnh vận chuyển</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Lưu trữ dữ liệu 03 năm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Miễn phí phần mềm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Không giới hạn số lượng</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Cài đặt ngay. Đảm bảo pháp lý.</span>
                  </li>
                </ul>
                <div className="bg-blue-50 -mx-6 -mb-6 p-6">
                  <Link to="/products/transport" className="block">
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                      Tìm hiểu thêm
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Sản phẩm 2: Vé xe khách điện tử */}
            <Card className="border-2 border-blue-200 hover:border-primary transition-all shadow-lg">
              <CardHeader className="bg-blue-50 pb-4">
                <h3 className="text-xl font-bold text-gray-900">Vé xe khách điện tử</h3>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="text-4xl font-bold text-purple-700 mb-2">Chỉ từ 100.000 đ</div>
                  <p className="text-gray-600">/vé</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Đảm bảo yêu cầu pháp lý</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Đồng bộ dữ liệu Lệnh điện tử</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Kết nối bán vé hơn 400 bến xe</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Tích hợp phần mềm kế toán</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Kết nối hệ sinh thái bán vé tại bến xe</span>
                  </li>
                </ul>
                <div className="bg-blue-50 -mx-6 -mb-6 p-6">
                  <Link to="/products/transport" className="block">
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                      Tìm hiểu thêm
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Sản phẩm 3: Chữ ký số HSM */}
            <Card className="border-2 border-blue-200 hover:border-primary transition-all shadow-lg">
              <CardHeader className="bg-blue-50 pb-4">
                <h3 className="text-xl font-bold text-gray-900">Chữ ký số HSM</h3>
              </CardHeader>
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="text-4xl font-bold text-purple-700 mb-2">600.000 ₫</div>
                  <p className="text-gray-600">/năm</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Không giới hạn số lần ký</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Truy cập mọi lúc mọi nơi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Mua 01 lần dùng cả năm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Chứng thư số server, tốc độ ký cao</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Sử dụng ký lệnh và vé</span>
                  </li>
                </ul>
                <div className="bg-blue-50 -mx-6 -mb-6 p-6">
                  <Link to="/products/partner" className="block">
                    <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                      Tìm hiểu thêm
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Footer CTA Section */}
          <div className="bg-slate-700 text-white rounded-lg p-8 lg:p-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <p className="text-lg lg:text-xl leading-relaxed">
                  Hơn <span className="font-bold">500</span> bến xe và <span className="font-bold">20.000+</span> phương tiện 
                  và <span className="font-bold">900+</span> ĐVVT trong cả nước đã sẵn sàng chuyển đổi{" "}
                  <span className="font-bold">vé điện tử & lệnh vận chuyển điện tử</span>. 
                  Chúng tôi cùng bạn đang tạo dựng nên cuộc chuyển đổi số trong vận tải hành khách.
                </p>
              </div>
              <div className="flex-shrink-0">
                <Link to="/lien-he">
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8">
                    Liên hệ
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
