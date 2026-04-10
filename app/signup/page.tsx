"use client";
export default function SignupPage() {
    return (
      <main className="min-h-screen bg-[#0B1220] text-[#F8FAFC]">
        <section className="flex min-h-screen items-center justify-center px-6 py-24">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-[0_0_40px_rgba(34,211,238,0.08)] fade-in">
            <div className="mb-8 text-center">
              <p className="mb-3 inline-block rounded-full bg-cyan-400/10 px-4 py-1 text-sm text-cyan-300">
                Create Your Account
              </p>
  
              <h1 className="mb-3 text-3xl font-bold text-cyan-300">
                Sign Up
              </h1>
  
              <p className="text-sm leading-7 text-slate-300">
                Join Creative Motion Lab to access digital rehabilitation tools,
                movement analysis, and connected care workflows.
              </p>
            </div>
  
            <form className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
  
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
  
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Create a password"
                  className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
  
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Account Type
                </label>
                <select className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-white outline-none transition focus:border-cyan-400">
                  <option>Patient</option>
                  <option>Clinician</option>
                </select>
              </div>
              <button
  type="button"
  onClick={() => {
    const select = document.querySelector("select") as HTMLSelectElement;
    const type = select.value;

    localStorage.setItem("userType", type.toLowerCase());
    window.location.href = "/login";
  }}
  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 font-semibold text-black transition duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(34,211,238,0.35)]"
>
  Create Account
</button>
            </form>
  
            <div className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <a href="/login" className="text-cyan-300 hover:text-cyan-200">
                Sign in
              </a>
            </div>
          </div>
        </section>
      </main>
    );
  }