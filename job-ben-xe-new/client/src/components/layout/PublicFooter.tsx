import { Link } from "react-router-dom"
import { Facebook, Youtube, Linkedin, Instagram, Mail, Phone } from "lucide-react"

export function PublicFooter() {
  return (
    <footer className="bg-gray-800 text-gray-300 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Khám phá */}
          <div>
            <h4 className="text-white font-semibold mb-4">Khám phá</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/home" className="hover:text-white transition-colors">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  Công ty của chúng tôi
                </Link>
              </li>
              <li>
                <Link to="/case-study" className="hover:text-white transition-colors">
                  Case study
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Theo dõi chúng tôi */}
          <div>
            <h4 className="text-white font-semibold mb-4">Theo dõi chúng tôi</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Youtube className="h-4 w-4" />
                  Youtube
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                  Linkedin
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Liên lạc */}
          <div>
            <h4 className="text-white font-semibold mb-4">Liên lạc</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="mailto:abctn@gmail.com"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  abctn@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:19004751"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  1900.4751
                </a>
              </li>
            </ul>
          </div>

          {/* Địa chỉ */}
          <div>
            <h4 className="text-white font-semibold mb-4">Địa chỉ</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <p className="font-medium text-white mb-1">Trụ sở chính:</p>
                <p className="text-gray-400">
                  ABC
                </p>
              </li>
              <li>
                <p className="font-medium text-white mb-1">Văn phòng Miền Trung:</p>
                <p className="text-gray-400">
                  ABC
                </p>
              </li>
              <li>
                <p className="font-medium text-white mb-1">Văn phòng Miền Nam:</p>
                <p className="text-gray-400">
                  ABC
                </p>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} ABC C&T. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  )
}

