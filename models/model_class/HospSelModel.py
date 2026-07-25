from torch import nn

class HospitalSelectorModel(nn.Module):
    def __init__(self, _nFeature :int):
        super(HospitalSelectorModel, self).__init__()

        self._nFeature = _nFeature
        self.model =  nn.Sequential(
            nn.Linear(_nFeature, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )
        
    def forward(self, inp :np.ndarray):
        return self.model(inp)

   