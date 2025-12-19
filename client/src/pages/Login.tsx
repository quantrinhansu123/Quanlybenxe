import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { User, Lock, Bus, MapPin, Clock, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuthStore } from "@/store/auth.store"
import logo from "@/assets/logo.png"

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Tên đăng nhập hoặc email là bắt buộc"),
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

const BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=1920&q=80"

const features = [
  { icon: Bus, text: "Quản lý xe hiệu quả" },
  { icon: MapPin, text: "Theo dõi tuyến đường" },
  { icon: Clock, text: "Lịch trình chính xác" },
  { icon: Shield, text: "Bảo mật an toàn" },
]

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      setError("")
      await login(data.usernameOrEmail, data.password, data.rememberMe)
      navigate("/")
    } catch {
      setError("Tên đăng nhập/email hoặc mật khẩu không đúng")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/80 to-indigo-900/90" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Bus className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Quản Lý Bến Xe</h1>
              <p className="text-blue-200 text-sm">Hệ thống quản lý thông minh</p>
            </div>
          </div>

          {/* Main Hero Content */}
          <div className="space-y-8 max-w-lg">
            <div className="space-y-4">
              <h2 className="text-4xl xl:text-5xl font-bold leading-tight">
                Giải pháp quản lý
                <span className="text-amber-400"> bến xe </span>
                hiện đại
              </h2>
              <p className="text-blue-100 text-lg leading-relaxed">
                Tối ưu hóa quy trình vận hành, theo dõi phương tiện theo thời gian thực và nâng cao hiệu quả kinh doanh.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 hover:bg-white/15 transition-colors"
                >
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Stats */}
          <div className="flex items-center gap-8 pt-8 border-t border-white/10">
            <div>
              <div className="text-3xl font-bold text-amber-400">500+</div>
              <div className="text-blue-200 text-sm">Phương tiện</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-400">50+</div>
              <div className="text-blue-200 text-sm">Tuyến đường</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-400">99.9%</div>
              <div className="text-blue-200 text-sm">Độ tin cậy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Bus className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Quản Lý Bến Xe</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center lg:text-left">
            <div className="mb-6 flex justify-center lg:justify-start">
              <img
                src={logo}
                alt="Logo"
                className="h-16 w-auto object-contain"
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Chào mừng trở lại
            </h2>
            <p className="mt-2 text-gray-600">
              Đăng nhập để tiếp tục quản lý hệ thống
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usernameOrEmail" className="text-gray-700 font-medium">
                  Tên đăng nhập hoặc Email
                </Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    id="usernameOrEmail"
                    type="text"
                    placeholder="Nhập tên đăng nhập hoặc email"
                    className="pl-12 h-12 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    {...register("usernameOrEmail")}
                  />
                </div>
                {errors.usernameOrEmail && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full" />
                    {errors.usernameOrEmail.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Mật khẩu
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Nhập mật khẩu"
                    className="pl-12 h-12 bg-white border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    {...register("password")}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-red-500 rounded-full" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  {...register("rememberMe")}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                >
                  Ghi nhớ đăng nhập
                </Label>
              </div>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang đăng nhập...</span>
                </div>
              ) : (
                "Đăng nhập"
              )}
            </Button>

            <div className="text-center">
              <span className="text-gray-600">Chưa có tài khoản? </span>
              <Link
                to="/register"
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                Đăng ký ngay
              </Link>
            </div>
          </form>

          {/* Footer */}
          <div className="pt-8 text-center text-sm text-gray-500">
            <p>© 2025 Hệ thống Quản lý Bến xe. Bảo lưu mọi quyền.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
