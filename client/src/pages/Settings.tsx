import { useState } from 'react';
import { Save, Lock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    setProfileError('');
    try {
      await api.put('/auth/profile', { name, email });
      setProfileMsg('Perfil atualizado com sucesso');
    } catch (err: any) {
      setProfileError(err.response?.data?.error || 'Erro ao atualizar perfil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      setPasswordLoading(false);
      return;
    }

    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setPasswordMsg('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
      <h1 className="text-xl font-bold text-foreground">Configurações</h1>
      {/* Profile section */}
      <section className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Dados do Perfil</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            {profileMsg && <p className="text-sm text-green-600">{profileMsg}</p>}
            <button
              type="submit"
              disabled={profileLoading}
              className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 w-full sm:w-auto"
            >
              <Save size={16} /> {profileLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </section>

        {/* Password section */}
        <section className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Alterar Senha</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Senha atual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Nova senha</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordMsg && <p className="text-sm text-green-600">{passwordMsg}</p>}
            <button
              type="submit"
              disabled={passwordLoading}
              className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 w-full sm:w-auto"
            >
              <Lock size={16} /> {passwordLoading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </section>
      </main>
    );
  }
