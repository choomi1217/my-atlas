import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Company } from '@/types/features';
import { companyApi } from '@/api/features';
import { Breadcrumb } from '@/components/features/Breadcrumb';
import { useActiveCompany } from '@/context/ActiveCompanyContext';
import CompanyFormModal from '@/components/features/CompanyFormModal';
import ConfirmDialog from '@/components/features/ConfirmDialog';

type SortOption = 'name' | 'newest';

export default function CompanyListPage() {
  const navigate = useNavigate();
  const { setActiveCompany } = useActiveCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

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

  const filteredAndSorted = useMemo(() => {
    let result = companies;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [companies, searchQuery, sortBy]);

  const handleAddCompany = async (name: string) => {
    const company = await companyApi.create(name);
    setCompanies([...companies, company]);
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await companyApi.delete(deleteTarget.id);
      setCompanies(companies.filter((c) => c.id !== deleteTarget.id));
    } catch (error) {
      console.error('Failed to delete company:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Breadcrumb />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-4">Companies</h1>

            {/* Search + Sort bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  &#128269;
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search companies..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="name">Sort: Name</option>
                <option value="newest">Sort: Newest</option>
              </select>
            </div>
          </div>

          {/* Companies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Add New Card */}
            <div
              onClick={() => setShowAddModal(true)}
              className="p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg
                         hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition
                         flex flex-col items-center justify-center min-h-[120px]"
            >
              <span className="text-3xl text-gray-400 mb-1">+</span>
              <span className="text-sm text-gray-500">Add New</span>
            </div>

            {/* Company Cards */}
            {filteredAndSorted.map((company) => (
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
                      setDeleteTarget({ id: company.id, name: company.name });
                    }}
                    className="flex-1 px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredAndSorted.length === 0 && companies.length > 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No companies match your search.</p>
            </div>
          )}

          {companies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No companies yet. Click "+" to create one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      <CompanyFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddCompany}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Company"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All products and test cases under this company will also be deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
