import { activateStudent, parseStudentActivationProof } from './activateStudent'
describe('student activation links', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })
  it('parses exactly one Member ID and 256-bit base64url link proof', () => {
    const token = 'a'.repeat(43)
    expect(parseStudentActivationProof(`#memberId=DXM-7K3M9Q2RW5TY&token=${token}`)).toEqual({
      memberId: 'DXM-7K3M9Q2RW5TY',
      token,
    })
    expect(parseStudentActivationProof(`?memberId=DXM-7K3M9Q2RW5TY&token=${token}`)).toEqual({
      memberId: 'DXM-7K3M9Q2RW5TY',
      token,
    })
    expect(parseStudentActivationProof('#memberId=invalid&token=short')).toBeNull()
    expect(
      parseStudentActivationProof(`#memberId=DXM-7K3M9Q2RW5TY&token=${token}&token=${token}`),
    ).toBeNull()
    expect(
      parseStudentActivationProof(
        `#memberId=DXM-7K3M9Q2RW5TY&token=${token}&next=https://evil.invalid`,
      ),
    ).toBeNull()
  })
  it('submits a captured link with link authority rather than backup authority', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fictional-public-key')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Ready.' }), { status: 200 }))
    await activateStudent({
      memberId: 'DXM-7K3M9Q2RW5TY',
      activationCode: 'a'.repeat(43),
      credentialType: 'link',
      password: 'fictional-private-password',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          memberId: 'DXM-7K3M9Q2RW5TY',
          credential: 'a'.repeat(43),
          credentialType: 'link',
          password: 'fictional-private-password',
        }),
      }),
    )
  })
})
