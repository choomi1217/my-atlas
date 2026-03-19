import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Company } from '@/types/features';
import { companyApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import { useActiveCompany } from '@/context/ActiveCompanyContext';

export default function CompanyListPage() {
  const navigate = useNavigate();
  const { setActiveCompany } = useActiveCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newCompanyName, setNewCompanyName] = useState('');

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await companyApi.getAll();
        setCompanies(data);
      } catch (error) {
        console.error('Failed to load companies:', error);
      }
    };
    loadCompanies();
  }, []);

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    try {
      const company = await companyApi.create(newCompanyName);
      setCompanies([...companies, company]);
      setNewCompanyName('');
    } catch (error) {
      console.error('Failed to create company:', error);
    }
  };

  const handleSelectCompany = (company: Company) => {
    setActiveCompany(company);
    navigate(`/features/companies/${company.id}`);
  };

  const handleSetActiveCompany = async (company: Company) => {
    try {
      const updated = await companyApi.setActive(company.id);
      setCompanies(
        companies.map((c) => ({ ...c, isActive: c.id === updated.id }))
      );
    } catch (error) {
      console.error('Failed to set active company:', error);
    }
  };

  const handleDeleteCompany = async (id: number) => {
    if (!window.confirm('Delete this company?')) return;
    try {
      await companyApi.delete(id);
      setCompanies(companies.filter((c) => c.id !== id));
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header + Add Company Form */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-4">Companies</h1>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCompany()}
                  placeholder="Company name..."
                  className="flex-1 px-3 py-2 border rounded"
                />
                <button
                  onClick={handleAddCompany}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Company
                </button>
              </div>
            </div>
          </div>

          {/* Companies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company) => (
              <div
                key={company.id}
                onClick={() => handleSelectCompany(company)}
                className="p-4 bg-white border rounded-lg shadow hover:shadow-lg cursor-pointer transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold">{company.name}</h3>
                  {company.isActive && (
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {!company.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActiveCompany(company);
                      }}
                      className="flex-1 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCompany(company.id);
                    }}
                    className="flex-1 px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {companies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No companies yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
